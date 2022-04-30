// Mediocre shim
let Worker;
const workerAdd = ";var __w=require('worker_threads');__w.parentPort.on('message',function(m){onmessage({data:m})}),postMessage=function(m,t){__w.parentPort.postMessage(m,t)},close=process.exit;self=global";
try {
    Worker = require('worker_threads').Worker;
}
catch (e) {
}
export default Worker ? (c, _, msg, transfer, cb) => {
    let done = false;
    const w = new Worker(c + workerAdd, { eval: true })
        .on('error', e => cb(e, null))
        .on('message', m => cb(null, m))
        .on('exit', c => {
        if (c && !done)
            cb(new Error('exited with code ' + c), null);
    });
    w.postMessage(msg, transfer);
    w.terminate = () => {
        done = true;
        return Worker.prototype.terminate.call(w);
    };
    return w;
} : (_, __, ___, ____, cb) => {
    setImmediate(() => cb(new Error('async operations unsupported - update to Node 12+ (or Node 10-11 with the --experimental-worker CLI flag)'), null));
    const NOP = () => { };
    return {
        terminate: NOP,
        postMessage: NOP
    };
};
