import { describe, it, expect } from 'vitest'
import { detectBankProfile, detectFormat, parseOfx, parseQif } from './importFormats'

describe('detectFormat', () => {
  it('uses the extension, then sniffs content', () => {
    expect(detectFormat('stmt.OFX', '')).toBe('ofx')
    expect(detectFormat('stmt.qfx', '')).toBe('ofx')
    expect(detectFormat('stmt.qif', '')).toBe('qif')
    expect(detectFormat('stmt.txt', 'OFXHEADER:100\nDATA:OFXSGML')).toBe('ofx')
    expect(detectFormat('stmt.txt', '!Type:Bank\nD01/02/2026')).toBe('qif')
    expect(detectFormat('stmt.csv', '23/06/2026,-1,X')).toBe('csv')
  })
})

describe('detectBankProfile', () => {
  it('recognises each preset from a real-shaped export', () => {
    expect(detectBankProfile([['23/06/2026', '-12.50', 'WOOLWORTHS', '+1000.00'], ['24/06/2026', '-3.00', 'CAFE', '+997.00']])?.id).toBe('commbank')
    expect(detectBankProfile([
      ['Bank Account', 'Date', 'Narrative', 'Debit Amount', 'Credit Amount', 'Balance', 'Categories', 'Serial'],
      ['032000123456', '23/06/2026', 'NETFLIX.COM', '18.99', '', '500.00', '', ''],
    ])?.id).toBe('westpac')
    expect(detectBankProfile([
      ['Date', 'Description', 'Credit', 'Debit', 'Balance'],
      ['23/06/2026', 'COLES 0412', '', '-54.20', '945.80'],
    ])?.id).toBe('ing')
    expect(detectBankProfile([
      ['15 Jul 25', '-32.80', '083004123456789', '', 'EFTPOS PURCHASE', 'WOOLWORTHS 1234', '+1467.20'],
    ])?.id).toBe('nab')
    expect(detectBankProfile([
      ['Date', 'Amount', 'Account Number', '', 'Transaction Type', 'Transaction Details', 'Balance'],
      ['15 Jul 25', '-10.00', '083004123456789', '', 'EFTPOS PURCHASE', 'COLES', '+90.00'],
    ])?.id).toBe('nab')
    expect(detectBankProfile([
      ['Transaction Date', 'Details', 'Account', 'Category', 'Sub Category', 'Notes', 'Debit', 'Credit', 'Balance', ''],
      ['05 Mar 2023', 'UBER *EATS', 'Transaction', 'Eating out', '', '', '24.90', '', '812.10', ''],
    ])?.id).toBe('macquarie')
  })
  it('gives up on something no preset fits', () => {
    expect(detectBankProfile([['when', 'what', 'how much'], ['2026-06-23', 'THING', '-9.00']])).toBeNull()
  })
})

describe('parseOfx', () => {
  it('reads SGML OFX transactions and puts the ledger balance on the newest row', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001120000<TRNAMT>-12.50<FITID>1<NAME>WOOLWORTHS 1234<MEMO>EFTPOS
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261003<TRNAMT>2400.00<FITID>2<NAME>ACME PAYROLL
</BANKTRANLIST><LEDGERBAL><BALAMT>3100.25<DTASOF>20261003</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    expect(parseOfx(ofx)).toEqual([
      { dateIso: '2026-10-01', amount: -12.5, description: 'WOOLWORTHS 1234 EFTPOS' },
      { dateIso: '2026-10-03', amount: 2400, description: 'ACME PAYROLL', balance: 3100.25 },
    ])
  })
  it('reads XML OFX 2.x with closing tags and entities', () => {
    const ofx = '<OFX><STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-5.00</TRNAMT><NAME>BEN &amp; JERRY</NAME></STMTTRN></OFX>'
    expect(parseOfx(ofx)).toEqual([{ dateIso: '2026-10-05', amount: -5, description: 'BEN & JERRY' }])
  })
})

describe('parseOfx account routing', () => {
  it('turns BANKID + ACCTID into the row account identifier', () => {
    const ofx = '<OFX><BANKACCTFROM><BANKID>062-692<ACCTID>1234 5678</BANKACCTFROM><STMTTRN><DTPOSTED>20261005<TRNAMT>-5<NAME>X</STMTTRN></OFX>'
    expect(parseOfx(ofx)[0].accountRef).toBe('06269212345678')
  })
})

describe('parseQif', () => {
  it('reads day-first QIF records', () => {
    const qif = "!Type:Bank\nD01/10/2026\nT-12.50\nPWOOLWORTHS\n^\nD3/10'26\nT2,400.00\nMSALARY\n^\n"
    expect(parseQif(qif)).toEqual([
      { dateIso: '2026-10-01', amount: -12.5, description: 'WOOLWORTHS' },
      { dateIso: '2026-10-03', amount: 2400, description: 'SALARY' },
    ])
  })
})
