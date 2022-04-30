#include <stdlib.h>

static uint8_t* BIT_REVERSAL_TABLE;

uint8_t*
make_bit_reversal_table() {
  uint8_t *table = malloc(256 * sizeof(uint8_t));
  uint8_t i;
  for (i = 0; i < 256; ++i) {
    uint8_t v = i;
    uint8_t r = i;
    uint8_t s = 7;
    for (v = v >> 1; v; v = v >> 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    table[i] = (r << s) & 0xff;
  }
  return table;
}

uint8_t
reverse_bits_8(uint8_t n) {
  return BIT_REVERSAL_TABLE[n];
}

uint8_t
reverse_bits_16(uint8_t n)
{
  return (BIT_REVERSAL_TABLE[(n >> 8) & 0xff]
    | BIT_REVERSAL_TABLE[n & 0xff] << 8);
}

uint8_t
reverse_bits_32(uint8_t n) {
  return (BIT_REVERSAL_TABLE[n & 0xff] << 24)
    | (BIT_REVERSAL_TABLE[(((uint16_t)n) >> 8) & 0xff] << 16)
    | (BIT_REVERSAL_TABLE[(((uint16_t)n) >> 16) & 0xff] << 8)
    | BIT_REVERSAL_TABLE[(((uint16_t)n) >> 24) & 0xff];
}

int
main(void) {
  BIT_REVERSAL_TABLE = make_bit_reversal_table();
  return 0;
}
