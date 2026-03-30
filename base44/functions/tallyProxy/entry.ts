import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TallyPrime Proxy Function
 * 
 * TallyPrime runs as an XML-over-HTTP server on your local network (default port 9000).
 * Since the browser cannot directly call a local IP from our cloud app, this backend
 * function acts as a bridge — it forwards XML requests to your TallyPrime server and
 * returns the parsed response.
 * 
 * IMPORTANT: Your TallyPrime server must be accessible from the internet (or a tunnel).
 * See the Tally Integration page in the app for setup instructions.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, tallyUrl, xmlRequest } = body;

    if (!tallyUrl) {
      return Response.json({ error: 'Tally server URL is required' }, { status: 400 });
    }

    // Test connection action
    if (action === 'test') {
      const testXml = `<ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>EXPORT</TALLYREQUEST>
          <TYPE>COLLECTION</TYPE>
          <ID>List of Companies</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>`;

      const response = await fetch(tallyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: testXml,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return Response.json({ success: false, error: `Tally returned HTTP ${response.status}` });
      }

      const text = await response.text();
      return Response.json({ success: true, message: 'Connected to TallyPrime successfully!', response: text });
    }

    // Fetch ledgers action
    if (action === 'getLedgers') {
      const xml = `<ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>EXPORT</TALLYREQUEST>
          <TYPE>COLLECTION</TYPE>
          <ID>List of Ledgers</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>`;

      const response = await fetch(tallyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml,
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      return Response.json({ success: true, data: text });
    }

    // Push voucher (payment/receipt) to Tally
    if (action === 'pushVoucher') {
      const { voucherType, date, narration, debitLedger, creditLedger, amount, companyName } = body;

      if (!voucherType || !date || !debitLedger || !creditLedger || !amount) {
        return Response.json({ error: 'Missing required voucher fields' }, { status: 400 });
      }

      const formattedDate = date.replace(/-/g, ''); // YYYYMMDD format for Tally

      const voucherXml = `<ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>IMPORT</TALLYREQUEST>
          <TYPE>DATA</TYPE>
          <SUBTYPE>VOUCHERS</SUBTYPE>
          <ID>Vouchers</ID>
        </HEADER>
        <BODY>
          <DESC></DESC>
          <DATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <VOUCHER REMOTEID="" VCHTYPE="${voucherType}" ACTION="Create">
                <DATE>${formattedDate}</DATE>
                <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
                <NARRATION>${narration || ''}</NARRATION>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${debitLedger}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                  <AMOUNT>${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${creditLedger}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
              </VOUCHER>
            </TALLYMESSAGE>
          </DATA>
        </BODY>
      </ENVELOPE>`;

      const response = await fetch(tallyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: voucherXml,
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      const success = text.includes('<STATUS>1</STATUS>');
      return Response.json({ success, message: success ? 'Voucher pushed to Tally successfully' : 'Tally returned an error', response: text });
    }

    // Custom XML request
    if (action === 'custom' && xmlRequest) {
      const response = await fetch(tallyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xmlRequest,
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      return Response.json({ success: true, data: text });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    if (error.name === 'TimeoutError') {
      return Response.json({ success: false, error: 'Connection timed out. Make sure TallyPrime is running and accessible.' }, { status: 408 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});