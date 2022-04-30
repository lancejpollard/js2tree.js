// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad
// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.
// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).
// import wk from './node-worker';
// aliases for shorter compressed code (most minifers don't do this)
const u8 = Uint8Array, u16 = Uint16Array, u32 = Uint32Array;
// fixed length extra bits
const fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
// fixed distance extra bits
// see fleb note
const fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
// code length index map
const clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
// get base, reverse index map from extra bits
const freb = (eb, start) => {
    const b = new u16(31);
    for (let i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
    }
    // numbers here are at max 18 bits
    const r = new u32(b[30]);
    for (let i = 1; i < 30; ++i) {
        for (let j = b[i]; j < b[i + 1]; ++j) {
            r[j] = ((j - b[i]) << 5) | i;
        }
    }
    return [b, r];
};
const [fl, revfl] = freb(fleb, 2);
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
const [fd, revfd] = freb(fdeb, 0);
// map of value to reverse (assuming 16 bits)
const rev = new u16(32768);
for (let i = 0; i < 32768; ++i) {
    // reverse table algorithm from SO
    let x = ((i & 0xAAAA) >>> 1) | ((i & 0x5555) << 1);
    x = ((x & 0xCCCC) >>> 2) | ((x & 0x3333) << 2);
    x = ((x & 0xF0F0) >>> 4) | ((x & 0x0F0F) << 4);
    rev[i] = (((x & 0xFF00) >>> 8) | ((x & 0x00FF) << 8)) >>> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
const hMap = ((cd, mb, r) => {
    const s = cd.length;
    // index
    let i = 0;
    // u16 "map": index -> # of codes with bit length = index
    const l = new u16(mb);
    // length of cd must be 288 (total # of codes)
    for (; i < s; ++i) {
        if (cd[i])
            ++l[cd[i] - 1];
    }
    // u16 "map": index -> minimum code for bit length = index
    const le = new u16(mb);
    for (i = 0; i < mb; ++i) {
        le[i] = (le[i - 1] + l[i - 1]) << 1;
    }
    let co;
    if (r) {
        // u16 "map": index -> number of actual bits, symbol for code
        co = new u16(1 << mb);
        // bits to remove for reverser
        const rvb = 15 - mb;
        for (i = 0; i < s; ++i) {
            // ignore 0 lengths
            if (cd[i]) {
                // num encoding both symbol and bits read
                const sv = (i << 4) | cd[i];
                // free bits
                const r = mb - cd[i];
                // start value
                let v = le[cd[i] - 1]++ << r;
                // m is end value
                for (const m = v | ((1 << r) - 1); v <= m; ++v) {
                    // every 16 bit value starting with the code yields the same result
                    co[rev[v] >>> rvb] = sv;
                }
            }
        }
    }
    else {
        co = new u16(s);
        for (i = 0; i < s; ++i) {
            if (cd[i]) {
                co[i] = rev[le[cd[i] - 1]++] >>> (15 - cd[i]);
            }
        }
    }
    return co;
});
// fixed length tree
const flt = new u8(288);
for (let i = 0; i < 144; ++i)
    flt[i] = 8;
for (let i = 144; i < 256; ++i)
    flt[i] = 9;
for (let i = 256; i < 280; ++i)
    flt[i] = 7;
for (let i = 280; i < 288; ++i)
    flt[i] = 8;
// fixed distance tree
const fdt = new u8(32);
for (let i = 0; i < 32; ++i)
    fdt[i] = 5;
// fixed length map
const flm = /*#__PURE__*/ hMap(flt, 9, 0), flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
const fdm = /*#__PURE__*/ hMap(fdt, 5, 0), fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
// find max of array
const max = (a) => {
    let m = a[0];
    for (let i = 1; i < a.length; ++i) {
        if (a[i] > m)
            m = a[i];
    }
    return m;
};
// read d, starting at bit p and mask with m
const bits = (d, p, m) => {
    const o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
};
// read d, starting at bit p continuing for at least 16 bits
const bits16 = (d, p) => {
    const o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
};
// get end of byte
const shft = (p) => ((p + 7) / 8) | 0;
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
const slc = (v, s, e) => {
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    // can't use .constructor in case user-supplied
    const n = new (v.BYTES_PER_ELEMENT == 2 ? u16 : v.BYTES_PER_ELEMENT == 4 ? u32 : u8)(e - s);
    n.set(v.subarray(s, e));
    return n;
};
/**
 * Codes for errors generated within this library
 */
export const FlateErrorCode = {
    UnexpectedEOF: 0,
    InvalidBlockType: 1,
    InvalidLengthLiteral: 2,
    InvalidDistance: 3,
    StreamFinished: 4,
    NoStreamHandler: 5,
    InvalidHeader: 6,
    NoCallback: 7,
    InvalidUTF8: 8,
    ExtraFieldTooLong: 9,
    InvalidDate: 10,
    FilenameTooLong: 11,
    StreamFinishing: 12,
    InvalidZipData: 13,
    UnknownCompressionMethod: 14
};
// error codes
const ec = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    ,
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data'
    // determined by unknown compression method
];
;
const err = (ind, msg, nt) => {
    const e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
    if (!nt)
        throw e;
    return e;
};
// expands raw DEFLATE data
const inflt = (dat, buf, st) => {
    // source length
    const sl = dat.length;
    if (!sl || (st && st.f && !st.l))
        return buf || new u8(0);
    // have to estimate size
    const noBuf = !buf || st;
    // no state
    const noSt = !st || st.i;
    if (!st)
        st = {};
    // Assumes roughly 33% compression ratio average
    if (!buf)
        buf = new u8(sl * 3);
    // ensure buffer can fit at least l elements
    const cbuf = (l) => {
        let bl = buf.length;
        // need to increase size to fit
        if (l > bl) {
            // Double or set to necessary, whichever is greater
            const nbuf = new u8(Math.max(bl * 2, l));
            nbuf.set(buf);
            buf = nbuf;
        }
    };
    //  last chunk         bitpos           bytes
    let final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    // total bits
    const tbts = sl * 8;
    do {
        if (!lm) {
            // BFINAL - this is only 1 when last chunk is next
            final = bits(dat, pos, 1);
            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
            const type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
                // go to end of byte boundary
                const s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
                if (t > sl) {
                    if (noSt)
                        err(0);
                    break;
                }
                // ensure size
                if (noBuf)
                    cbuf(bt + l);
                // Copy over uncompressed data
                buf.set(dat.subarray(s, t), bt);
                // Get new bitpos, update byte count
                st.b = bt += l, st.p = pos = t * 8, st.f = final;
                continue;
            }
            else if (type == 1)
                lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
                //  literal                            lengths
                const hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                const tl = hLit + bits(dat, pos + 5, 31) + 1;
                pos += 14;
                // length+distance tree
                const ldt = new u8(tl);
                // code length tree
                const clt = new u8(19);
                for (let i = 0; i < hcLen; ++i) {
                    // use index map to get real code
                    clt[clim[i]] = bits(dat, pos + i * 3, 7);
                }
                pos += hcLen * 3;
                // code lengths bits
                const clb = max(clt), clbmsk = (1 << clb) - 1;
                // code lengths map
                const clm = hMap(clt, clb, 1);
                for (let i = 0; i < tl;) {
                    const r = clm[bits(dat, pos, clbmsk)];
                    // bits read
                    pos += r & 15;
                    // symbol
                    const s = r >>> 4;
                    // code length to copy
                    if (s < 16) {
                        ldt[i++] = s;
                    }
                    else {
                        //  copy   count
                        let c = 0, n = 0;
                        if (s == 16)
                            n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                        else if (s == 17)
                            n = 3 + bits(dat, pos, 7), pos += 3;
                        else if (s == 18)
                            n = 11 + bits(dat, pos, 127), pos += 7;
                        while (n--)
                            ldt[i++] = c;
                    }
                }
                //    length tree                 distance tree
                const lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                // max length bits
                lbt = max(lt);
                // max dist bits
                dbt = max(dt);
                lm = hMap(lt, lbt, 1);
                dm = hMap(dt, dbt, 1);
            }
            else
                err(1);
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
        }
        // Make sure the buffer can hold this + the largest possible addition
        // Maximum chunk size (practically, theoretically infinite) is 2^17;
        if (noBuf)
            cbuf(bt + 131072);
        const lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        let lpos = pos;
        for (;; lpos = pos) {
            // bits read, code
            const c = lm[bits16(dat, pos) & lms], sym = c >>> 4;
            pos += c & 15;
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
            if (!c)
                err(2);
            if (sym < 256)
                buf[bt++] = sym;
            else if (sym == 256) {
                lpos = pos, lm = null;
                break;
            }
            else {
                let add = sym - 254;
                // no extra bits needed if less
                if (sym > 264) {
                    // index
                    const i = sym - 257, b = fleb[i];
                    add = bits(dat, pos, (1 << b) - 1) + fl[i];
                    pos += b;
                }
                // dist
                const d = dm[bits16(dat, pos) & dms], dsym = d >>> 4;
                if (!d)
                    err(3);
                pos += d & 15;
                let dt = fd[dsym];
                if (dsym > 3) {
                    const b = fdeb[dsym];
                    dt += bits16(dat, pos) & ((1 << b) - 1), pos += b;
                }
                if (pos > tbts) {
                    if (noSt)
                        err(0);
                    break;
                }
                if (noBuf)
                    cbuf(bt + 131072);
                const end = bt + add;
                for (; bt < end; bt += 4) {
                    buf[bt] = buf[bt - dt];
                    buf[bt + 1] = buf[bt + 1 - dt];
                    buf[bt + 2] = buf[bt + 2 - dt];
                    buf[bt + 3] = buf[bt + 3 - dt];
                }
                bt = end;
            }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
            final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt == buf.length ? buf : slc(buf, 0, bt);
};
// starting at p, write the minimum number of bits that can hold v to d
const wbits = (d, p, v) => {
    v <<= p & 7;
    const o = (p / 8) | 0;
    d[o] |= v;
    d[o + 1] |= v >>> 8;
};
// starting at p, write the minimum number of bits (>8) that can hold v to d
const wbits16 = (d, p, v) => {
    v <<= p & 7;
    const o = (p / 8) | 0;
    d[o] |= v;
    d[o + 1] |= v >>> 8;
    d[o + 2] |= v >>> 16;
};
// creates code lengths from a frequency table
const hTree = (d, mb) => {
    // Need extra info to make a tree
    const t = [];
    for (let i = 0; i < d.length; ++i) {
        if (d[i])
            t.push({ s: i, f: d[i] });
    }
    const s = t.length;
    const t2 = t.slice();
    if (!s)
        return [et, 0];
    if (s == 1) {
        const v = new u8(t[0].s + 1);
        v[t[0].s] = 1;
        return [v, 1];
    }
    t.sort((a, b) => a.f - b.f);
    // after i2 reaches last ind, will be stopped
    // freq must be greater than largest possible number of symbols
    t.push({ s: -1, f: 25001 });
    let l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    // efficient algorithm from UZIP.js
    // i0 is lookbehind, i2 is lookahead - after processing two low-freq
    // symbols that combined have high freq, will start processing i2 (high-freq,
    // non-composite) symbols instead
    // see https://reddit.com/r/photopea/comments/ikekht/uzipjs_questions/
    while (i1 != s - 1) {
        l = t[t[i0].f < t[i2].f ? i0++ : i2++];
        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
        t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    let maxSym = t2[0].s;
    for (let i = 1; i < s; ++i) {
        if (t2[i].s > maxSym)
            maxSym = t2[i].s;
    }
    // code lengths
    const tr = new u16(maxSym + 1);
    // max bits in tree
    let mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
        // more algorithms from UZIP.js
        // TODO: find out how this code works (debt)
        //  ind    debt
        let i = 0, dt = 0;
        //    left            cost
        const lft = mbt - mb, cst = 1 << lft;
        t2.sort((a, b) => tr[b.s] - tr[a.s] || a.f - b.f);
        for (; i < s; ++i) {
            const i2 = t2[i].s;
            if (tr[i2] > mb) {
                dt += cst - (1 << (mbt - tr[i2]));
                tr[i2] = mb;
            }
            else
                break;
        }
        dt >>>= lft;
        while (dt > 0) {
            const i2 = t2[i].s;
            if (tr[i2] < mb)
                dt -= 1 << (mb - tr[i2]++ - 1);
            else
                ++i;
        }
        for (; i >= 0 && dt; --i) {
            const i2 = t2[i].s;
            if (tr[i2] == mb) {
                --tr[i2];
                ++dt;
            }
        }
        mbt = mb;
    }
    return [new u8(tr), mbt];
};
// get the max length and assign length codes
const ln = (n, l, d) => {
    return n.s == -1
        ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1))
        : (l[n.s] = d);
};
// length codes generation
const lc = (c) => {
    let s = c.length;
    // Note that the semicolon was intentional
    while (s && !c[--s])
        ;
    const cl = new u16(++s);
    //  ind      num         streak
    let cli = 0, cln = c[0], cls = 1;
    const w = (v) => { cl[cli++] = v; };
    for (let i = 1; i <= s; ++i) {
        if (c[i] == cln && i != s)
            ++cls;
        else {
            if (!cln && cls > 2) {
                for (; cls > 138; cls -= 138)
                    w(32754);
                if (cls > 2) {
                    w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);
                    cls = 0;
                }
            }
            else if (cls > 3) {
                w(cln), --cls;
                for (; cls > 6; cls -= 6)
                    w(8304);
                if (cls > 2)
                    w(((cls - 3) << 5) | 8208), cls = 0;
            }
            while (cls--)
                w(cln);
            cls = 1;
            cln = c[i];
        }
    }
    return [cl.subarray(0, cli), s];
};
// calculate the length of output from tree, code lengths
const clen = (cf, cl) => {
    let l = 0;
    for (let i = 0; i < cl.length; ++i)
        l += cf[i] * cl[i];
    return l;
};
// writes a fixed block
// returns the new bit pos
const wfblk = (out, pos, dat) => {
    // no need to write 00 as type: TypedArray defaults to 0
    const s = dat.length;
    const o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >>> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (let i = 0; i < s; ++i)
        out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
};
// writes a block
const wblk = (dat, out, final, syms, lf, df, eb, li, bs, bl, p) => {
    wbits(out, p++, final);
    ++lf[256];
    const [dlt, mlb] = hTree(lf, 15);
    const [ddt, mdb] = hTree(df, 15);
    const [lclt, nlc] = lc(dlt);
    const [lcdt, ndc] = lc(ddt);
    const lcfreq = new u16(19);
    for (let i = 0; i < lclt.length; ++i)
        lcfreq[lclt[i] & 31]++;
    for (let i = 0; i < lcdt.length; ++i)
        lcfreq[lcdt[i] & 31]++;
    const [lct, mlcb] = hTree(lcfreq, 7);
    let nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
        ;
    const flen = (bl + 5) << 3;
    const ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    const dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + (2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18]);
    if (flen <= ftlen && flen <= dtlen)
        return wfblk(out, p, dat.subarray(bs, bs + bl));
    let lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
        const llm = hMap(lct, mlcb, 0);
        wbits(out, p, nlc - 257);
        wbits(out, p + 5, ndc - 1);
        wbits(out, p + 10, nlcc - 4);
        p += 14;
        for (let i = 0; i < nlcc; ++i)
            wbits(out, p + 3 * i, lct[clim[i]]);
        p += 3 * nlcc;
        const lcts = [lclt, lcdt];
        for (let it = 0; it < 2; ++it) {
            const clct = lcts[it];
            for (let i = 0; i < clct.length; ++i) {
                const len = clct[i] & 31;
                wbits(out, p, llm[len]), p += lct[len];
                if (len > 15)
                    wbits(out, p, (clct[i] >>> 5) & 127), p += clct[i] >>> 12;
            }
        }
    }
    else {
        lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (let i = 0; i < li; ++i) {
        if (syms[i] > 255) {
            const len = (syms[i] >>> 18) & 31;
            wbits16(out, p, lm[len + 257]), p += ll[len + 257];
            if (len > 7)
                wbits(out, p, (syms[i] >>> 23) & 31), p += fleb[len];
            const dst = syms[i] & 31;
            wbits16(out, p, dm[dst]), p += dl[dst];
            if (dst > 3)
                wbits16(out, p, (syms[i] >>> 5) & 8191), p += fdeb[dst];
        }
        else {
            wbits16(out, p, lm[syms[i]]), p += ll[syms[i]];
        }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
};
// deflate options (nice << 13) | chain
const deo = /*#__PURE__*/ new u32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
// empty
const et = /*#__PURE__*/ new u8(0);
// compresses data into a raw DEFLATE buffer
const dflt = (dat, lvl, plvl, pre, post, lst) => {
    const s = dat.length;
    const o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
    // writing to this writes to the output buffer
    const w = o.subarray(pre, o.length - post);
    let pos = 0;
    if (!lvl || s < 8) {
        for (let i = 0; i <= s; i += 65535) {
            // end
            const e = i + 65535;
            if (e >= s) {
                // write final block
                w[pos >> 3] = lst;
            }
            pos = wfblk(w, pos + 1, dat.subarray(i, e));
        }
    }
    else {
        const opt = deo[lvl - 1];
        const n = opt >>> 13, c = opt & 8191;
        const msk = (1 << plvl) - 1;
        //    prev 2-byte val map    curr 2-byte val map
        const prev = new u16(32768), head = new u16(msk + 1);
        const bs1 = Math.ceil(plvl / 3), bs2 = 2 * bs1;
        const hsh = (i) => (dat[i] ^ (dat[i + 1] << bs1) ^ (dat[i + 2] << bs2)) & msk;
        // 24576 is an arbitrary number of maximum symbols per block
        // 424 buffer for last block
        const syms = new u32(25000);
        // length/literal freq   distance freq
        const lf = new u16(288), df = new u16(32);
        //  l/lcnt  exbits  index  l/lind  waitdx  bitpos
        let lc = 0, eb = 0, i = 0, li = 0, wi = 0, bs = 0;
        for (; i < s; ++i) {
            // hash value
            // deopt when i > s - 3 - at end, deopt acceptable
            const hv = hsh(i);
            // index mod 32768    previous index mod
            let imod = i & 32767, pimod = head[hv];
            prev[imod] = pimod;
            head[hv] = imod;
            // We always should modify head and prev, but only add symbols if
            // this data is not yet processed ("wait" for wait index)
            if (wi <= i) {
                // bytes remaining
                const rem = s - i;
                if ((lc > 7000 || li > 24576) && rem > 423) {
                    pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
                    li = lc = eb = 0, bs = i;
                    for (let j = 0; j < 286; ++j)
                        lf[j] = 0;
                    for (let j = 0; j < 30; ++j)
                        df[j] = 0;
                }
                //  len    dist   chain
                let l = 2, d = 0, ch = c, dif = (imod - pimod) & 32767;
                if (rem > 2 && hv == hsh(i - dif)) {
                    const maxn = Math.min(n, rem) - 1;
                    const maxd = Math.min(32767, i);
                    // max possible length
                    // not capped at dif because decompressors implement "rolling" index population
                    const ml = Math.min(258, rem);
                    while (dif <= maxd && --ch && imod != pimod) {
                        if (dat[i + l] == dat[i + l - dif]) {
                            let nl = 0;
                            for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                                ;
                            if (nl > l) {
                                l = nl, d = dif;
                                // break out early when we reach "nice" (we are satisfied enough)
                                if (nl > maxn)
                                    break;
                                // now, find the rarest 2-byte sequence within this
                                // length of literals and search for that instead.
                                // Much faster than just using the start
                                const mmd = Math.min(dif, nl - 2);
                                let md = 0;
                                for (let j = 0; j < mmd; ++j) {
                                    const ti = (i - dif + j + 32768) & 32767;
                                    const pti = prev[ti];
                                    const cd = (ti - pti + 32768) & 32767;
                                    if (cd > md)
                                        md = cd, pimod = ti;
                                }
                            }
                        }
                        // check the previous match
                        imod = pimod, pimod = prev[imod];
                        dif += (imod - pimod + 32768) & 32767;
                    }
                }
                // d will be nonzero only when a match was found
                if (d) {
                    // store both dist and len data in one Uint32
                    // Make sure this is recognized as a len/dist with 28th bit (2^28)
                    syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];
                    const lin = revfl[l] & 31, din = revfd[d] & 31;
                    eb += fleb[lin] + fdeb[din];
                    ++lf[257 + lin];
                    ++df[din];
                    wi = i + l;
                    ++lc;
                }
                else {
                    syms[li++] = dat[i];
                    ++lf[dat[i]];
                }
            }
        }
        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
        // this is the easiest way to avoid needing to maintain state
        if (!lst && pos & 7)
            pos = wfblk(w, pos + 1, et);
    }
    return slc(o, 0, pre + shft(pos) + post);
};
// CRC32 table
const crct = /*#__PURE__*/ (() => {
    const t = new Int32Array(256);
    for (let i = 0; i < 256; ++i) {
        let c = i, k = 9;
        while (--k)
            c = ((c & 1) && -306674912) ^ (c >>> 1);
        t[i] = c;
    }
    return t;
})();
// CRC32
const crc = () => {
    let c = -1;
    return {
        p(d) {
            // closures have awful performance
            let cr = c;
            for (let i = 0; i < d.length; ++i)
                cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);
            c = cr;
        },
        d() { return ~c; }
    };
};
// Alder32
const adler = () => {
    let a = 1, b = 0;
    return {
        p(d) {
            // closures have awful performance
            let n = a, m = b;
            const l = d.length | 0;
            for (let i = 0; i != l;) {
                const e = Math.min(i + 2655, l);
                for (; i < e; ++i)
                    m += n += d[i];
                n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
            }
            a = n, b = m;
        },
        d() {
            a %= 65521, b %= 65521;
            return (a & 255) << 24 | (a >>> 8) << 16 | (b & 255) << 8 | (b >>> 8);
        }
    };
};
;
// deflate with opts
const dopt = (dat, opt, pre, post, st) => dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : (12 + opt.mem), pre, post, !st);
// Walmart object spread
const mrg = (a, b) => {
    const o = {};
    for (const k in a)
        o[k] = a[k];
    for (const k in b)
        o[k] = b[k];
    return o;
};
// worker clone
// This is possibly the craziest part of the entire codebase, despite how simple it may seem.
// The only parameter to this function is a closure that returns an array of variables outside of the function scope.
// We're going to try to figure out the variable names used in the closure as strings because that is crucial for workerization.
// We will return an object mapping of true variable name to value (basically, the current scope as a JS object).
// The reason we can't just use the original variable names is minifiers mangling the toplevel scope.
// This took me three weeks to figure out how to do.
const wcln = (fn, fnStr, td) => {
    const dt = fn();
    const st = fn.toString();
    const ks = st.slice(st.indexOf('[') + 1, st.lastIndexOf(']')).replace(/\s+/g, '').split(',');
    for (let i = 0; i < dt.length; ++i) {
        let v = dt[i], k = ks[i];
        if (typeof v == 'function') {
            fnStr += ';' + k + '=';
            const st = v.toString();
            if (v.prototype) {
                // for global objects
                if (st.indexOf('[native code]') != -1) {
                    const spInd = st.indexOf(' ', 8) + 1;
                    fnStr += st.slice(spInd, st.indexOf('(', spInd));
                }
                else {
                    fnStr += st;
                    for (const t in v.prototype)
                        fnStr += ';' + k + '.prototype.' + t + '=' + v.prototype[t].toString();
                }
            }
            else
                fnStr += st;
        }
        else
            td[k] = v;
    }
    return [fnStr, td];
};
const ch = [];
// clone bufs
const cbfs = (v) => {
    const tl = [];
    for (const k in v) {
        if (v[k].buffer) {
            tl.push((v[k] = new v[k].constructor(v[k])).buffer);
        }
    }
    return tl;
};
// use a worker to execute code
const wrkr = (fns, init, id, cb) => {
    if (!ch[id]) {
        let fnStr = '', td = {}, m = fns.length - 1;
        for (let i = 0; i < m; ++i)
            [fnStr, td] = wcln(fns[i], fnStr, td);
        ch[id] = wcln(fns[m], fnStr, td);
    }
    const td = mrg({}, ch[id][1]);
    return wk(ch[id][0] + ';onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=' + init.toString() + '}', id, td, cbfs(td), cb);
};
// base async inflate fn
const bInflt = () => [u8, u16, u32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gu8];
const bDflt = () => [u8, u16, u32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf];
// gzip extra
const gze = () => [gzh, gzhl, wbytes, crc, crct];
// gunzip extra
const guze = () => [gzs, gzl];
// zlib extra
const zle = () => [zlh, wbytes, adler];
// unzlib extra
const zule = () => [zlv];
// post buf
const pbf = (msg) => postMessage(msg, [msg.buffer]);
// get u8
const gu8 = (o) => o && o.size && new u8(o.size);
// async helper
const cbify = (dat, opts, fns, init, id, cb) => {
    const w = wrkr(fns, init, id, (err, dat) => {
        w.terminate();
        cb(err, dat);
    });
    w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
    return () => { w.terminate(); };
};
// auto stream
const astrm = (strm) => {
    strm.ondata = (dat, final) => postMessage([dat, final], [dat.buffer]);
    return (ev) => strm.push(ev.data[0], ev.data[1]);
};
// async stream attach
const astrmify = (fns, strm, opts, init, id) => {
    let t;
    const w = wrkr(fns, init, id, (err, dat) => {
        if (err)
            w.terminate(), strm.ondata.call(strm, err);
        else {
            if (dat[1])
                w.terminate();
            strm.ondata.call(strm, err, dat[0], dat[1]);
        }
    });
    w.postMessage(opts);
    strm.push = (d, f) => {
        if (!strm.ondata)
            err(5);
        if (t)
            strm.ondata(err(4, 0, 1), null, !!f);
        w.postMessage([d, t = f], [d.buffer]);
    };
    strm.terminate = () => { w.terminate(); };
};
// read 2 bytes
const b2 = (d, b) => d[b] | (d[b + 1] << 8);
// read 4 bytes
const b4 = (d, b) => (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0;
const b8 = (d, b) => b4(d, b) + (b4(d, b + 4) * 4294967296);
// write bytes
const wbytes = (d, b, v) => {
    for (; v; ++b)
        d[b] = v, v >>>= 8;
};
// gzip header
const gzh = (c, o) => {
    const fn = o.filename;
    c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3; // assume Unix
    if (o.mtime != 0)
        wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1000));
    if (fn) {
        c[3] = 8;
        for (let i = 0; i <= fn.length; ++i)
            c[i + 10] = fn.charCodeAt(i);
    }
};
// gzip footer: -8 to -4 = CRC, -4 to -0 is length
// gzip start
const gzs = (d) => {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
        err(6, 'invalid gzip data');
    const flg = d[3];
    let st = 10;
    if (flg & 4)
        st += d[10] | (d[11] << 8) + 2;
    for (let zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
        ;
    return st + (flg & 2);
};
// gzip length
const gzl = (d) => {
    const l = d.length;
    return ((d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16) | (d[l - 1] << 24)) >>> 0;
};
// gzip header length
const gzhl = (o) => 10 + ((o.filename && (o.filename.length + 1)) || 0);
// zlib header
const zlh = (c, o) => {
    const lv = o.level, fl = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
    c[0] = 120, c[1] = (fl << 6) | (fl ? (32 - 2 * fl) : 1);
};
// zlib valid
const zlv = (d) => {
    if ((d[0] & 15) != 8 || (d[0] >>> 4) > 7 || ((d[0] << 8 | d[1]) % 31))
        err(6, 'invalid zlib data');
    if (d[1] & 32)
        err(6, 'invalid zlib data: preset dictionaries not supported');
};
function AsyncCmpStrm(opts, cb) {
    if (!cb && typeof opts == 'function')
        cb = opts, opts = {};
    this.ondata = cb;
    return opts;
}
// zlib footer: -4 to -0 is Adler32
/**
 * Streaming DEFLATE compression
 */
export class Deflate {
    constructor(opts, cb) {
        if (!cb && typeof opts == 'function')
            cb = opts, opts = {};
        this.ondata = cb;
        this.o = opts || {};
    }
    p(c, f) {
        this.ondata(dopt(c, this.o, 0, 0, !f), f);
    }
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        this.d = final;
        this.p(chunk, final || false);
    }
}
/**
 * Asynchronous streaming DEFLATE compression
 */
export class AsyncDeflate {
    constructor(opts, cb) {
        astrmify([
            bDflt,
            () => [astrm, Deflate]
        ], this, AsyncCmpStrm.call(this, opts, cb), ev => {
            const strm = new Deflate(ev.data);
            onmessage = astrm(strm);
        }, 6);
    }
}
export function deflate(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
    ], ev => pbf(deflateSync(ev.data[0], ev.data[1])), 0, cb);
}
/**
 * Compresses data with DEFLATE without any wrapper
 * @param data The data to compress
 * @param opts The compression options
 * @returns The deflated version of the data
 */
export function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
}
/**
 * Streaming DEFLATE decompression
 */
export class Inflate {
    /**
     * Creates an inflation stream
     * @param cb The callback to call whenever data is inflated
     */
    constructor(cb) {
        this.s = {};
        this.p = new u8(0);
        this.ondata = cb;
    }
    e(c) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        const l = this.p.length;
        const n = new u8(l + c.length);
        n.set(this.p), n.set(c, l), this.p = n;
    }
    c(final) {
        this.d = this.s.i = final || false;
        const bts = this.s.b;
        const dt = inflt(this.p, this.o, this.s);
        this.ondata(slc(dt, bts, this.s.b), this.d);
        this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
        this.p = slc(this.p, (this.s.p / 8) | 0), this.s.p &= 7;
    }
    /**
     * Pushes a chunk to be inflated
     * @param chunk The chunk to push
     * @param final Whether this is the final chunk
     */
    push(chunk, final) {
        this.e(chunk), this.c(final);
    }
}
/**
 * Asynchronous streaming DEFLATE decompression
 */
export class AsyncInflate {
    /**
     * Creates an asynchronous inflation stream
     * @param cb The callback to call whenever data is deflated
     */
    constructor(cb) {
        this.ondata = cb;
        astrmify([
            bInflt,
            () => [astrm, Inflate]
        ], this, 0, () => {
            const strm = new Inflate();
            onmessage = astrm(strm);
        }, 7);
    }
}
export function inflate(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt
    ], ev => pbf(inflateSync(ev.data[0], gu8(ev.data[1]))), 1, cb);
}
/**
 * Expands DEFLATE data with no wrapper
 * @param data The data to decompress
 * @param out Where to write the data. Saves memory if you know the decompressed size and provide an output buffer of that length.
 * @returns The decompressed version of the data
 */
export function inflateSync(data, out) {
    return inflt(data, out);
}
// before you yell at me for not just using extends, my reason is that TS inheritance is hard to workerize.
/**
 * Streaming GZIP compression
 */
export class Gzip {
    constructor(opts, cb) {
        this.c = crc();
        this.l = 0;
        this.v = 1;
        Deflate.call(this, opts, cb);
    }
    /**
     * Pushes a chunk to be GZIPped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        Deflate.prototype.push.call(this, chunk, final);
    }
    p(c, f) {
        this.c.p(c);
        this.l += c.length;
        const raw = dopt(c, this.o, this.v && gzhl(this.o), f && 8, !f);
        if (this.v)
            gzh(raw, this.o), this.v = 0;
        if (f)
            wbytes(raw, raw.length - 8, this.c.d()), wbytes(raw, raw.length - 4, this.l);
        this.ondata(raw, f);
    }
}
/**
 * Asynchronous streaming GZIP compression
 */
export class AsyncGzip {
    constructor(opts, cb) {
        astrmify([
            bDflt,
            gze,
            () => [astrm, Deflate, Gzip]
        ], this, AsyncCmpStrm.call(this, opts, cb), ev => {
            const strm = new Gzip(ev.data);
            onmessage = astrm(strm);
        }, 8);
    }
}
export function gzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
        gze,
        () => [gzipSync]
    ], ev => pbf(gzipSync(ev.data[0], ev.data[1])), 2, cb);
}
/**
 * Compresses data with GZIP
 * @param data The data to compress
 * @param opts The compression options
 * @returns The gzipped version of the data
 */
export function gzipSync(data, opts) {
    if (!opts)
        opts = {};
    const c = crc(), l = data.length;
    c.p(data);
    const d = dopt(data, opts, gzhl(opts), 8), s = d.length;
    return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
}
/**
 * Streaming GZIP decompression
 */
export class Gunzip {
    /**
     * Creates a GUNZIP stream
     * @param cb The callback to call whenever data is inflated
     */
    constructor(cb) {
        this.v = 1;
        Inflate.call(this, cb);
    }
    /**
     * Pushes a chunk to be GUNZIPped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        if (this.v) {
            const s = this.p.length > 3 ? gzs(this.p) : 4;
            if (s >= this.p.length && !final)
                return;
            this.p = this.p.subarray(s), this.v = 0;
        }
        if (final) {
            if (this.p.length < 8)
                err(6, 'invalid gzip data');
            this.p = this.p.subarray(0, -8);
        }
        // necessary to prevent TS from using the closure value
        // This allows for workerization to function correctly
        Inflate.prototype.c.call(this, final);
    }
}
/**
 * Asynchronous streaming GZIP decompression
 */
export class AsyncGunzip {
    /**
     * Creates an asynchronous GUNZIP stream
     * @param cb The callback to call whenever data is deflated
     */
    constructor(cb) {
        this.ondata = cb;
        astrmify([
            bInflt,
            guze,
            () => [astrm, Inflate, Gunzip]
        ], this, 0, () => {
            const strm = new Gunzip();
            onmessage = astrm(strm);
        }, 9);
    }
}
export function gunzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt,
        guze,
        () => [gunzipSync]
    ], ev => pbf(gunzipSync(ev.data[0])), 3, cb);
}
/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param out Where to write the data. GZIP already encodes the output size, so providing this doesn't save memory.
 * @returns The decompressed version of the data
 */
export function gunzipSync(data, out) {
    return inflt(data.subarray(gzs(data), -8), out || new u8(gzl(data)));
}
/**
 * Streaming Zlib compression
 */
export class Zlib {
    constructor(opts, cb) {
        this.c = adler();
        this.v = 1;
        Deflate.call(this, opts, cb);
    }
    /**
     * Pushes a chunk to be zlibbed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        Deflate.prototype.push.call(this, chunk, final);
    }
    p(c, f) {
        this.c.p(c);
        const raw = dopt(c, this.o, this.v && 2, f && 4, !f);
        if (this.v)
            zlh(raw, this.o), this.v = 0;
        if (f)
            wbytes(raw, raw.length - 4, this.c.d());
        this.ondata(raw, f);
    }
}
/**
 * Asynchronous streaming Zlib compression
 */
export class AsyncZlib {
    constructor(opts, cb) {
        astrmify([
            bDflt,
            zle,
            () => [astrm, Deflate, Zlib]
        ], this, AsyncCmpStrm.call(this, opts, cb), ev => {
            const strm = new Zlib(ev.data);
            onmessage = astrm(strm);
        }, 10);
    }
}
export function zlib(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
        zle,
        () => [zlibSync]
    ], ev => pbf(zlibSync(ev.data[0], ev.data[1])), 4, cb);
}
/**
 * Compress data with Zlib
 * @param data The data to compress
 * @param opts The compression options
 * @returns The zlib-compressed version of the data
 */
export function zlibSync(data, opts) {
    if (!opts)
        opts = {};
    const a = adler();
    a.p(data);
    const d = dopt(data, opts, 2, 4);
    return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
/**
 * Streaming Zlib decompression
 */
export class Unzlib {
    /**
     * Creates a Zlib decompression stream
     * @param cb The callback to call whenever data is inflated
     */
    constructor(cb) {
        this.v = 1;
        Inflate.call(this, cb);
    }
    /**
     * Pushes a chunk to be unzlibbed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        if (this.v) {
            if (this.p.length < 2 && !final)
                return;
            this.p = this.p.subarray(2), this.v = 0;
        }
        if (final) {
            if (this.p.length < 4)
                err(6, 'invalid zlib data');
            this.p = this.p.subarray(0, -4);
        }
        // necessary to prevent TS from using the closure value
        // This allows for workerization to function correctly
        Inflate.prototype.c.call(this, final);
    }
}
/**
 * Asynchronous streaming Zlib decompression
 */
export class AsyncUnzlib {
    /**
     * Creates an asynchronous Zlib decompression stream
     * @param cb The callback to call whenever data is deflated
     */
    constructor(cb) {
        this.ondata = cb;
        astrmify([
            bInflt,
            zule,
            () => [astrm, Inflate, Unzlib]
        ], this, 0, () => {
            const strm = new Unzlib();
            onmessage = astrm(strm);
        }, 11);
    }
}
export function unzlib(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt,
        zule,
        () => [unzlibSync]
    ], ev => pbf(unzlibSync(ev.data[0], gu8(ev.data[1]))), 5, cb);
}
/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param out Where to write the data. Saves memory if you know the decompressed size and provide an output buffer of that length.
 * @returns The decompressed version of the data
 */
export function unzlibSync(data, out) {
    return inflt((zlv(data), data.subarray(2, -4)), out);
}
// Default algorithm for compression (used because having a known output size allows faster decompression)
export { gzip as compress, AsyncGzip as AsyncCompress };
// Default algorithm for compression (used because having a known output size allows faster decompression)
export { gzipSync as compressSync, Gzip as Compress };
/**
 * Streaming GZIP, Zlib, or raw DEFLATE decompression
 */
export class Decompress {
    /**
     * Creates a decompression stream
     * @param cb The callback to call whenever data is decompressed
     */
    constructor(cb) {
        this.G = Gunzip;
        this.I = Inflate;
        this.Z = Unzlib;
        this.ondata = cb;
    }
    /**
     * Pushes a chunk to be decompressed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.ondata)
            err(5);
        if (!this.s) {
            if (this.p && this.p.length) {
                const n = new u8(this.p.length + chunk.length);
                n.set(this.p), n.set(chunk, this.p.length);
            }
            else
                this.p = chunk;
            if (this.p.length > 2) {
                const _this = this;
                const cb = function () { _this.ondata.apply(_this, arguments); };
                this.s = (this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8)
                    ? new this.G(cb)
                    : ((this.p[0] & 15) != 8 || (this.p[0] >> 4) > 7 || ((this.p[0] << 8 | this.p[1]) % 31))
                        ? new this.I(cb)
                        : new this.Z(cb);
                this.s.push(this.p, final);
                this.p = null;
            }
        }
        else
            this.s.push(chunk, final);
    }
}
/**
 * Asynchronous streaming GZIP, Zlib, or raw DEFLATE decompression
 */
export class AsyncDecompress {
    /**
   * Creates an asynchronous decompression stream
   * @param cb The callback to call whenever data is decompressed
   */
    constructor(cb) {
        this.G = AsyncGunzip;
        this.I = AsyncInflate;
        this.Z = AsyncUnzlib;
        this.ondata = cb;
    }
    /**
     * Pushes a chunk to be decompressed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        Decompress.prototype.push.call(this, chunk, final);
    }
}
export function decompress(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return (data[0] == 31 && data[1] == 139 && data[2] == 8)
        ? gunzip(data, opts, cb)
        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))
            ? inflate(data, opts, cb)
            : unzlib(data, opts, cb);
}
/**
 * Expands compressed GZIP, Zlib, or raw DEFLATE data, automatically detecting the format
 * @param data The data to decompress
 * @param out Where to write the data. Saves memory if you know the decompressed size and provide an output buffer of that length.
 * @returns The decompressed version of the data
 */
export function decompressSync(data, out) {
    return (data[0] == 31 && data[1] == 139 && data[2] == 8)
        ? gunzipSync(data, out)
        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))
            ? inflateSync(data, out)
            : unzlibSync(data, out);
}
// flatten a directory structure
const fltn = (d, p, t, o) => {
    for (const k in d) {
        let val = d[k], n = p + k, op = o;
        if (Array.isArray(val))
            op = mrg(o, val[1]), val = val[0];
        if (val instanceof u8)
            t[n] = [val, op];
        else {
            t[n += '/'] = [new u8(0), op];
            fltn(val, n, t, o);
        }
    }
};
// text encoder
const te = typeof TextEncoder != 'undefined' && /*#__PURE__*/ new TextEncoder();
// text decoder
const td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
// text decoder stream
let tds = 0;
try {
    td.decode(et, { stream: true });
    tds = 1;
}
catch (e) { }
// decode UTF8
const dutf8 = (d) => {
    for (let r = '', i = 0;;) {
        let c = d[i++];
        const eb = (c > 127) + (c > 223) + (c > 239);
        if (i + eb > d.length)
            return [r, slc(d, i - 1)];
        if (!eb)
            r += String.fromCharCode(c);
        else if (eb == 3) {
            c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63)) - 65536,
                r += String.fromCharCode(55296 | (c >> 10), 56320 | (c & 1023));
        }
        else if (eb & 1)
            r += String.fromCharCode((c & 31) << 6 | (d[i++] & 63));
        else
            r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63));
    }
};
/**
 * Streaming UTF-8 decoding
 */
export class DecodeUTF8 {
    /**
     * Creates a UTF-8 decoding stream
     * @param cb The callback to call whenever data is decoded
     */
    constructor(cb) {
        this.ondata = cb;
        if (tds)
            this.t = new TextDecoder();
        else
            this.p = et;
    }
    /**
     * Pushes a chunk to be decoded from UTF-8 binary
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.ondata)
            err(5);
        final = !!final;
        if (this.t) {
            this.ondata(this.t.decode(chunk, { stream: true }), final);
            if (final) {
                if (this.t.decode().length)
                    err(8);
                this.t = null;
            }
            return;
        }
        if (!this.p)
            err(4);
        const dat = new u8(this.p.length + chunk.length);
        dat.set(this.p);
        dat.set(chunk, this.p.length);
        const [ch, np] = dutf8(dat);
        if (final) {
            if (np.length)
                err(8);
            this.p = null;
        }
        else
            this.p = np;
        this.ondata(ch, final);
    }
}
/**
 * Streaming UTF-8 encoding
 */
export class EncodeUTF8 {
    /**
     * Creates a UTF-8 decoding stream
     * @param cb The callback to call whenever data is encoded
     */
    constructor(cb) {
        this.ondata = cb;
    }
    /**
     * Pushes a chunk to be encoded to UTF-8
     * @param chunk The string data to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        this.ondata(strToU8(chunk), this.d = final || false);
    }
}
/**
 * Converts a string into a Uint8Array for use with compression/decompression methods
 * @param str The string to encode
 * @param latin1 Whether or not to interpret the data as Latin-1. This should
 *               not need to be true unless decoding a binary string.
 * @returns The string encoded in UTF-8/Latin-1 binary
 */
export function strToU8(str, latin1) {
    if (latin1) {
        const ar = new u8(str.length);
        for (let i = 0; i < str.length; ++i)
            ar[i] = str.charCodeAt(i);
        return ar;
    }
    if (te)
        return te.encode(str);
    const l = str.length;
    let ar = new u8(str.length + (str.length >> 1));
    let ai = 0;
    const w = (v) => { ar[ai++] = v; };
    for (let i = 0; i < l; ++i) {
        if (ai + 5 > ar.length) {
            const n = new u8(ai + 8 + ((l - i) << 1));
            n.set(ar);
            ar = n;
        }
        let c = str.charCodeAt(i);
        if (c < 128 || latin1)
            w(c);
        else if (c < 2048)
            w(192 | (c >> 6)), w(128 | (c & 63));
        else if (c > 55295 && c < 57344)
            c = 65536 + (c & 1023 << 10) | (str.charCodeAt(++i) & 1023),
                w(240 | (c >> 18)), w(128 | ((c >> 12) & 63)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
        else
            w(224 | (c >> 12)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
    }
    return slc(ar, 0, ai);
}
/**
 * Converts a Uint8Array to a string
 * @param dat The data to decode to string
 * @param latin1 Whether or not to interpret the data as Latin-1. This should
 *               not need to be true unless encoding to binary string.
 * @returns The original UTF-8/Latin-1 string
 */
export function strFromU8(dat, latin1) {
    if (latin1) {
        let r = '';
        for (let i = 0; i < dat.length; i += 16384)
            r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
        return r;
    }
    else if (td)
        return td.decode(dat);
    else {
        const [out, ext] = dutf8(dat);
        if (ext.length)
            err(8);
        return out;
    }
}
;
// deflate bit flag
const dbf = (l) => l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0;
// skip local zip header
const slzh = (d, b) => b + 30 + b2(d, b + 26) + b2(d, b + 28);
// read zip header
const zh = (d, b, z) => {
    const fnl = b2(d, b + 28), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl, bs = b4(d, b + 20);
    const [sc, su, off] = z && bs == 4294967295 ? z64e(d, es) : [bs, b4(d, b + 24), b4(d, b + 42)];
    return [b2(d, b + 10), sc, su, fn, es + b2(d, b + 30) + b2(d, b + 32), off];
};
// read zip64 extra field
const z64e = (d, b) => {
    for (; b2(d, b) != 1; b += 4 + b2(d, b + 2))
        ;
    return [b8(d, b + 12), b8(d, b + 4), b8(d, b + 20)];
};
// extra field length
const exfl = (ex) => {
    let le = 0;
    if (ex) {
        for (const k in ex) {
            const l = ex[k].length;
            if (l > 65535)
                err(9);
            le += l + 4;
        }
    }
    return le;
};
// write zip header
const wzh = (d, b, f, fn, u, c, ce, co) => {
    const fl = fn.length, ex = f.extra, col = co && co.length;
    let exl = exfl(ex);
    wbytes(d, b, ce != null ? 0x2014B50 : 0x4034B50), b += 4;
    if (ce != null)
        d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2; // spec compliance? what's that?
    d[b++] = (f.flag << 1) | (c == null && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    const dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
        err(10);
    wbytes(d, b, (y << 25) | ((dt.getMonth() + 1) << 21) | (dt.getDate() << 16) | (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >>> 1)), b += 4;
    if (c != null) {
        wbytes(d, b, f.crc);
        wbytes(d, b + 4, c);
        wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
        wbytes(d, b, col);
        wbytes(d, b + 6, f.attrs);
        wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl;
    if (exl) {
        for (const k in ex) {
            const exf = ex[k], l = exf.length;
            wbytes(d, b, +k);
            wbytes(d, b + 2, l);
            d.set(exf, b + 4), b += 4 + l;
        }
    }
    if (col)
        d.set(co, b), b += col;
    return b;
};
// write zip footer (end of central directory)
const wzf = (o, b, c, d, e) => {
    wbytes(o, b, 0x6054B50); // skip disk
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
};
/**
 * A pass-through stream to keep data uncompressed in a ZIP archive.
 */
export class ZipPassThrough {
    /**
     * Creates a pass-through stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     */
    constructor(filename) {
        this.filename = filename;
        this.c = crc();
        this.size = 0;
        this.compression = 0;
    }
    /**
     * Processes a chunk and pushes to the output stream. You can override this
     * method in a subclass for custom behavior, but by default this passes
     * the data through. You must call this.ondata(err, chunk, final) at some
     * point in this method.
     * @param chunk The chunk to process
     * @param final Whether this is the last chunk
     */
    process(chunk, final) {
        this.ondata(null, chunk, final);
    }
    /**
     * Pushes a chunk to be added. If you are subclassing this with a custom
     * compression algorithm, note that you must push data from the source
     * file only, pre-compression.
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.ondata)
            err(5);
        this.c.p(chunk);
        this.size += chunk.length;
        if (final)
            this.crc = this.c.d();
        this.process(chunk, final || false);
    }
}
// I don't extend because TypeScript extension adds 1kB of runtime bloat
/**
 * Streaming DEFLATE compression for ZIP archives. Prefer using AsyncZipDeflate
 * for better performance
 */
export class ZipDeflate {
    /**
     * Creates a DEFLATE stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     * @param opts The compression options
     */
    constructor(filename, opts) {
        if (!opts)
            opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new Deflate(opts, (dat, final) => {
            this.ondata(null, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
    }
    process(chunk, final) {
        try {
            this.d.push(chunk, final);
        }
        catch (e) {
            this.ondata(e, null, final);
        }
    }
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
    }
}
/**
 * Asynchronous streaming DEFLATE compression for ZIP archives
 */
export class AsyncZipDeflate {
    /**
     * Creates a DEFLATE stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     * @param opts The compression options
     */
    constructor(filename, opts) {
        if (!opts)
            opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new AsyncDeflate(opts, (err, dat, final) => {
            this.ondata(err, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
        this.terminate = this.d.terminate;
    }
    process(chunk, final) {
        this.d.push(chunk, final);
    }
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
    }
}
// TODO: Better tree shaking
/**
 * A zippable archive to which files can incrementally be added
 */
export class Zip {
    /**
     * Creates an empty ZIP archive to which files can be added
     * @param cb The callback to call whenever data for the generated ZIP archive
     *           is available
     */
    constructor(cb) {
        this.ondata = cb;
        this.u = [];
        this.d = 1;
    }
    /**
     * Adds a file to the ZIP archive
     * @param file The file stream to add
     */
    add(file) {
        if (!this.ondata)
            err(5);
        // finishing or finished
        if (this.d & 2)
            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
        else {
            const f = strToU8(file.filename), fl = f.length;
            const com = file.comment, o = com && strToU8(com);
            const u = fl != file.filename.length || (o && (com.length != o.length));
            const hl = fl + exfl(file.extra) + 30;
            if (fl > 65535)
                this.ondata(err(11, 0, 1), null, false);
            const header = new u8(hl);
            wzh(header, 0, file, f, u);
            let chks = [header];
            const pAll = () => {
                for (const chk of chks)
                    this.ondata(null, chk, false);
                chks = [];
            };
            let tr = this.d;
            this.d = 0;
            const ind = this.u.length;
            const uf = mrg(file, {
                f,
                u,
                o,
                t: () => {
                    if (file.terminate)
                        file.terminate();
                },
                r: () => {
                    pAll();
                    if (tr) {
                        const nxt = this.u[ind + 1];
                        if (nxt)
                            nxt.r();
                        else
                            this.d = 1;
                    }
                    tr = 1;
                }
            });
            let cl = 0;
            file.ondata = (err, dat, final) => {
                if (err) {
                    this.ondata(err, dat, final);
                    this.terminate();
                }
                else {
                    cl += dat.length;
                    chks.push(dat);
                    if (final) {
                        const dd = new u8(16);
                        wbytes(dd, 0, 0x8074B50);
                        wbytes(dd, 4, file.crc);
                        wbytes(dd, 8, cl);
                        wbytes(dd, 12, file.size);
                        chks.push(dd);
                        uf.c = cl, uf.b = hl + cl + 16, uf.crc = file.crc, uf.size = file.size;
                        if (tr)
                            uf.r();
                        tr = 1;
                    }
                    else if (tr)
                        pAll();
                }
            };
            this.u.push(uf);
        }
    }
    /**
     * Ends the process of adding files and prepares to emit the final chunks.
     * This *must* be called after adding all desired files for the resulting
     * ZIP file to work properly.
     */
    end() {
        if (this.d & 2) {
            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
            return;
        }
        if (this.d)
            this.e();
        else
            this.u.push({
                r: () => {
                    if (!(this.d & 1))
                        return;
                    this.u.splice(-1, 1);
                    this.e();
                },
                t: () => { }
            });
        this.d = 3;
    }
    e() {
        let bt = 0, l = 0, tl = 0;
        for (const f of this.u)
            tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
        const out = new u8(tl + 22);
        for (const f of this.u) {
            wzh(out, bt, f, f.f, f.u, f.c, l, f.o);
            bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
        }
        wzf(out, bt, this.u.length, tl, l);
        this.ondata(null, out, true);
        this.d = 2;
    }
    /**
     * A method to terminate any internal workers used by the stream. Subsequent
     * calls to add() will fail.
     */
    terminate() {
        for (const f of this.u)
            f.t();
        this.d = 2;
    }
}
export function zip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    const r = {};
    fltn(data, '', r, opts);
    const k = Object.keys(r);
    let lft = k.length, o = 0, tot = 0;
    const slft = lft, files = new Array(lft);
    const term = [];
    const tAll = () => {
        for (let i = 0; i < term.length; ++i)
            term[i]();
    };
    let cbd = (a, b) => {
        mt(() => { cb(a, b); });
    };
    mt(() => { cbd = cb; });
    const cbf = () => {
        const out = new u8(tot + 22), oe = o, cdl = tot - o;
        tot = 0;
        for (let i = 0; i < slft; ++i) {
            const f = files[i];
            try {
                const l = f.c.length;
                wzh(out, tot, f, f.f, f.u, l);
                const badd = 30 + f.f.length + exfl(f.extra);
                const loc = tot + badd;
                out.set(f.c, loc);
                wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;
            }
            catch (e) {
                return cbd(e, null);
            }
        }
        wzf(out, o, files.length, cdl, oe);
        cbd(null, out);
    };
    if (!lft)
        cbf();
    // Cannot use lft because it can decrease
    for (let i = 0; i < slft; ++i) {
        const fn = k[i];
        const [file, p] = r[fn];
        const c = crc(), size = file.length;
        c.p(file);
        const f = strToU8(fn), s = f.length;
        const com = p.comment, m = com && strToU8(com), ms = m && m.length;
        const exl = exfl(p.extra);
        const compression = p.level == 0 ? 0 : 8;
        const cbl = (e, d) => {
            if (e) {
                tAll();
                cbd(e, null);
            }
            else {
                const l = d.length;
                files[i] = mrg(p, {
                    size,
                    crc: c.d(),
                    c: d,
                    f,
                    m,
                    u: s != fn.length || (m && (com.length != ms)),
                    compression
                });
                o += 30 + s + exl + l;
                tot += 76 + 2 * (s + exl) + (ms || 0) + l;
                if (!--lft)
                    cbf();
            }
        };
        if (s > 65535)
            cbl(err(11, 0, 1), null);
        if (!compression)
            cbl(null, file);
        else if (size < 160000) {
            try {
                cbl(null, deflateSync(file, p));
            }
            catch (e) {
                cbl(e, null);
            }
        }
        else
            term.push(deflate(file, p, cbl));
    }
    return tAll;
}
/**
 * Synchronously creates a ZIP file. Prefer using `zip` for better performance
 * with more than one file.
 * @param data The directory structure for the ZIP archive
 * @param opts The main options, merged with per-file options
 * @returns The generated ZIP archive
 */
export function zipSync(data, opts) {
    if (!opts)
        opts = {};
    const r = {};
    const files = [];
    fltn(data, '', r, opts);
    let o = 0;
    let tot = 0;
    for (const fn in r) {
        const [file, p] = r[fn];
        const compression = p.level == 0 ? 0 : 8;
        const f = strToU8(fn), s = f.length;
        const com = p.comment, m = com && strToU8(com), ms = m && m.length;
        const exl = exfl(p.extra);
        if (s > 65535)
            err(11);
        const d = compression ? deflateSync(file, p) : file, l = d.length;
        const c = crc();
        c.p(file);
        files.push(mrg(p, {
            size: file.length,
            crc: c.d(),
            c: d,
            f,
            m,
            u: s != fn.length || (m && (com.length != ms)),
            o,
            compression
        }));
        o += 30 + s + exl + l;
        tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    const out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (let i = 0; i < files.length; ++i) {
        const f = files[i];
        wzh(out, f.o, f, f.f, f.u, f.c.length);
        const badd = 30 + f.f.length + exfl(f.extra);
        out.set(f.c, f.o + badd);
        wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
}
/**
 * Streaming pass-through decompression for ZIP archives
 */
export class UnzipPassThrough {
    push(data, final) {
        this.ondata(null, data, final);
    }
}
UnzipPassThrough.compression = 0;
/**
 * Streaming DEFLATE decompression for ZIP archives. Prefer AsyncZipInflate for
 * better performance.
 */
export class UnzipInflate {
    /**
     * Creates a DEFLATE decompression that can be used in ZIP archives
     */
    constructor() {
        this.i = new Inflate((dat, final) => {
            this.ondata(null, dat, final);
        });
    }
    push(data, final) {
        try {
            this.i.push(data, final);
        }
        catch (e) {
            this.ondata(e, null, final);
        }
    }
}
UnzipInflate.compression = 8;
/**
 * Asynchronous streaming DEFLATE decompression for ZIP archives
 */
export class AsyncUnzipInflate {
    /**
     * Creates a DEFLATE decompression that can be used in ZIP archives
     */
    constructor(_, sz) {
        if (sz < 320000) {
            this.i = new Inflate((dat, final) => {
                this.ondata(null, dat, final);
            });
        }
        else {
            this.i = new AsyncInflate((err, dat, final) => {
                this.ondata(err, dat, final);
            });
            this.terminate = this.i.terminate;
        }
    }
    push(data, final) {
        if (this.i.terminate)
            data = slc(data, 0);
        this.i.push(data, final);
    }
}
AsyncUnzipInflate.compression = 8;
/**
 * A ZIP archive decompression stream that emits files as they are discovered
 */
export class Unzip {
    /**
     * Creates a ZIP decompression stream
     * @param cb The callback to call whenever a file in the ZIP archive is found
     */
    constructor(cb) {
        this.onfile = cb;
        this.k = [];
        this.o = {
            0: UnzipPassThrough
        };
        this.p = et;
    }
    /**
     * Pushes a chunk to be unzipped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    push(chunk, final) {
        if (!this.onfile)
            err(5);
        if (!this.p)
            err(4);
        if (this.c > 0) {
            const len = Math.min(this.c, chunk.length);
            const toAdd = chunk.subarray(0, len);
            this.c -= len;
            if (this.d)
                this.d.push(toAdd, !this.c);
            else
                this.k[0].push(toAdd);
            chunk = chunk.subarray(len);
            if (chunk.length)
                return this.push(chunk, final);
        }
        else {
            let f = 0, i = 0, is, buf;
            if (!this.p.length)
                buf = chunk;
            else if (!chunk.length)
                buf = this.p;
            else {
                buf = new u8(this.p.length + chunk.length);
                buf.set(this.p), buf.set(chunk, this.p.length);
            }
            const l = buf.length, oc = this.c, add = oc && this.d;
            for (; i < l - 4; ++i) {
                const sig = b4(buf, i);
                if (sig == 0x4034B50) {
                    f = 1, is = i;
                    this.d = null;
                    this.c = 0;
                    const bf = b2(buf, i + 6), cmp = b2(buf, i + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i + 26), es = b2(buf, i + 28);
                    if (l > i + 30 + fnl + es) {
                        const chks = [];
                        this.k.unshift(chks);
                        f = 2;
                        let sc = b4(buf, i + 18), su = b4(buf, i + 22);
                        const fn = strFromU8(buf.subarray(i + 30, i += 30 + fnl), !u);
                        if (sc == 4294967295) {
                            [sc, su] = dd ? [-2] : z64e(buf, i);
                        }
                        else if (dd)
                            sc = -1;
                        i += es;
                        this.c = sc;
                        let d;
                        const file = {
                            name: fn,
                            compression: cmp,
                            start: () => {
                                if (!file.ondata)
                                    err(5);
                                if (!sc)
                                    file.ondata(null, et, true);
                                else {
                                    const ctr = this.o[cmp];
                                    if (!ctr)
                                        file.ondata(err(14, 'unknown compression type ' + cmp, 1), null, false);
                                    d = sc < 0 ? new ctr(fn) : new ctr(fn, sc, su);
                                    d.ondata = (err, dat, final) => { file.ondata(err, dat, final); };
                                    for (const dat of chks)
                                        d.push(dat, false);
                                    if (this.k[0] == chks && this.c)
                                        this.d = d;
                                    else
                                        d.push(et, true);
                                }
                            },
                            terminate: () => {
                                if (d && d.terminate)
                                    d.terminate();
                            }
                        };
                        if (sc >= 0)
                            file.size = sc, file.originalSize = su;
                        this.onfile(file);
                    }
                    break;
                }
                else if (oc) {
                    if (sig == 0x8074B50) {
                        is = i += 12 + (oc == -2 && 8), f = 3, this.c = 0;
                        break;
                    }
                    else if (sig == 0x2014B50) {
                        is = i -= 4, f = 3, this.c = 0;
                        break;
                    }
                }
            }
            this.p = et;
            if (oc < 0) {
                const dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 0x8074B50 && 4)) : buf.subarray(0, i);
                if (add)
                    add.push(dat, !!f);
                else
                    this.k[+(f == 2)].push(dat);
            }
            if (f & 2)
                return this.push(buf.subarray(i), final);
            this.p = buf.subarray(i);
        }
        if (final) {
            if (this.c)
                err(13);
            this.p = null;
        }
    }
    /**
     * Registers a decoder with the stream, allowing for files compressed with
     * the compression type provided to be expanded correctly
     * @param decoder The decoder constructor
     */
    register(decoder) {
        this.o[decoder.compression] = decoder;
    }
}
const mt = typeof queueMicrotask == 'function' ? queueMicrotask : typeof setTimeout == 'function' ? setTimeout : (fn) => { fn(); };
export function unzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    const term = [];
    const tAll = () => {
        for (let i = 0; i < term.length; ++i)
            term[i]();
    };
    const files = {};
    let cbd = (a, b) => {
        mt(() => { cb(a, b); });
    };
    mt(() => { cbd = cb; });
    let e = data.length - 22;
    for (; b4(data, e) != 0x6054B50; --e) {
        if (!e || data.length - e > 65558) {
            cbd(err(13, 0, 1), null);
            return tAll;
        }
    }
    ;
    let lft = b2(data, e + 8);
    if (lft) {
        let c = lft;
        let o = b4(data, e + 16);
        const z = o == 4294967295;
        if (z) {
            e = b4(data, e - 12);
            if (b4(data, e) != 0x6064B50) {
                cbd(err(13, 0, 1), null);
                return tAll;
            }
            c = lft = b4(data, e + 32);
            o = b4(data, e + 48);
        }
        const fltr = opts && opts.filter;
        for (let i = 0; i < c; ++i) {
            const [c, sc, su, fn, no, off] = zh(data, o, z), b = slzh(data, off);
            o = no;
            const cbl = (e, d) => {
                if (e) {
                    tAll();
                    cbd(e, null);
                }
                else {
                    if (d)
                        files[fn] = d;
                    if (!--lft)
                        cbd(null, files);
                }
            };
            if (!fltr || fltr({
                name: fn,
                size: sc,
                originalSize: su,
                compression: c
            })) {
                if (!c)
                    cbl(null, slc(data, b, b + sc));
                else if (c == 8) {
                    const infl = data.subarray(b, b + sc);
                    if (sc < 320000) {
                        try {
                            cbl(null, inflateSync(infl, new u8(su)));
                        }
                        catch (e) {
                            cbl(e, null);
                        }
                    }
                    else
                        term.push(inflate(infl, { size: su }, cbl));
                }
                else
                    cbl(err(14, 'unknown compression type ' + c, 1), null);
            }
            else
                cbl(null, null);
        }
    }
    else
        cbd(null, {});
    return tAll;
}
/**
 * Synchronously decompresses a ZIP archive. Prefer using `unzip` for better
 * performance with more than one file.
 * @param data The raw compressed ZIP file
 * @param opts The ZIP extraction options
 * @returns The decompressed files
 */
export function unzipSync(data, opts) {
    const files = {};
    let e = data.length - 22;
    for (; b4(data, e) != 0x6054B50; --e) {
        if (!e || data.length - e > 65558)
            err(13);
    }
    ;
    let c = b2(data, e + 8);
    if (!c)
        return {};
    let o = b4(data, e + 16);
    const z = o == 4294967295;
    if (z) {
        e = b4(data, e - 12);
        if (b4(data, e) != 0x6064B50)
            err(13);
        c = b4(data, e + 32);
        o = b4(data, e + 48);
    }
    const fltr = opts && opts.filter;
    for (let i = 0; i < c; ++i) {
        const [c, sc, su, fn, no, off] = zh(data, o, z), b = slzh(data, off);
        o = no;
        if (!fltr || fltr({
            name: fn,
            size: sc,
            originalSize: su,
            compression: c
        })) {
            if (!c)
                files[fn] = slc(data, b, b + sc);
            else if (c == 8)
                files[fn] = inflateSync(data.subarray(b, b + sc), new u8(su));
            else
                err(14, 'unknown compression type ' + c);
        }
    }
    return files;
}
