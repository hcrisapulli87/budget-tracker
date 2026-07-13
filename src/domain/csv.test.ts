import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('handles quoted fields with commas', () => {
    expect(parseCsv('"WOOLWORTHS, SYDNEY",-12.50')).toEqual([['WOOLWORTHS, SYDNEY', '-12.50']])
  })
  it('handles escaped quotes', () => {
    expect(parseCsv('"say ""hi""",1')).toEqual([['say "hi"', '1']])
  })
  it('handles CRLF and skips trailing blank line', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('handles newlines inside quotes', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']])
  })
})
