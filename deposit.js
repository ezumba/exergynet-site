/* ExergyNet Day-1 Base Mainnet deposit UI logic. No external libraries (CSP-safe).
 * Watch-only client: holds ONLY the public receiving address; the user's wallet signs their
 * own USDC transfer. All validation + crediting is done by the biological_proxy backend.
 * Never requests/stores a private key, seed, mnemonic, or operator signer. */
(function () {
  'use strict';
  var C = window.EXG_DAY1 || {};
  var $ = function (id) { return document.getElementById(id); };
  var isAddr = function (a) { return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a); };
  var lc = function (a) { return (a || '').toLowerCase(); };

  // ---- config sanity: receiver must be a real, non-zero, non-retired address ----
  function receiverStatus() {
    var w = lc(C.DEPOSIT_RECEIVING_WALLET);
    if (!w) return { ok: false, reason: 'unset' };
    if (!isAddr(w)) return { ok: false, reason: 'invalid' };
    if (w === lc(C.ZERO_ADDR)) return { ok: false, reason: 'zero' };
    if ((C.RETIRED_DENYLIST || []).map(lc).indexOf(w) >= 0) return { ok: false, reason: 'retired' };
    return { ok: true };
  }

  var state = { account: null, chainOk: false };
  function setStatus(msg, kind) {
    var el = $('dep-status'); if (!el) return;
    el.textContent = msg; el.className = 'dep-status' + (kind ? ' dep-' + kind : '');
  }
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }

  // ---- minimal ABI encoding (no libs) ----
  function pad32(hexNo0x) { while (hexNo0x.length < 64) hexNo0x = '0' + hexNo0x; return hexNo0x; }
  function addrArg(a) { return pad32(lc(a).replace(/^0x/, '')); }
  function uintArg(bi) { return pad32(bi.toString(16)); }
  function encBalanceOf(a) { return '0x70a08231' + addrArg(a); }              // balanceOf(address)
  function encTransfer(to, amt) { return '0xa9059cbb' + addrArg(to) + uintArg(amt); } // transfer(address,uint256)

  function rpc(method, params) {
    return window.ethereum.request({ method: method, params: params || [] });
  }
  function fmtUsdc(bi) {
    var d = BigInt(C.USDC_DECIMALS || 6), base = 10n ** d;
    var whole = bi / base, frac = (bi % base).toString().padStart(Number(d), '0').replace(/0+$/, '');
    return whole.toString() + (frac ? '.' + frac : '');
  }
  function toBaseUnits(str) {
    var d = Number(C.USDC_DECIMALS || 6);
    if (!/^\d+(\.\d+)?$/.test(str)) return null;
    var parts = str.split('.'), whole = parts[0], frac = (parts[1] || '').slice(0, d);
    while (frac.length < d) frac += '0';
    var v = BigInt(whole) * (10n ** BigInt(d)) + BigInt(frac || '0');
    return v > 0n ? v : null;
  }

  async function connectWallet() {
    if (!window.ethereum) { setStatus('No Ethereum wallet detected. Install a Base-compatible wallet.', 'err'); return; }
    try {
      var accts = await rpc('eth_requestAccounts');
      state.account = accts && accts[0];
      $('dep-account').textContent = state.account || '--';
      await ensureChain();
      await refreshBalance();
      updateEnable();
    } catch (e) { setStatus('Wallet connection failed: ' + (e && e.message || e), 'err'); }
  }

  async function ensureChain() {
    var cid = await rpc('eth_chainId');
    state.chainOk = lc(cid) === lc(C.CHAIN_ID_HEX);
    show('dep-switch', !state.chainOk);
    $('dep-network').textContent = state.chainOk ? (C.CHAIN_NAME + ' (8453)') : ('wrong network (' + parseInt(cid, 16) + ')');
    return state.chainOk;
  }

  async function switchChain() {
    try {
      await rpc('wallet_switchEthereumChain', [{ chainId: C.CHAIN_ID_HEX }]);
    } catch (e) {
      if (e && e.code === 4902) {
        await rpc('wallet_addEthereumChain', [{
          chainId: C.CHAIN_ID_HEX, chainName: C.CHAIN_NAME,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [C.RPC_URL], blockExplorerUrls: [C.BASESCAN]
        }]);
      }
    }
    await ensureChain(); await refreshBalance(); updateEnable();
  }

  async function refreshBalance() {
    if (!state.account || !state.chainOk) { $('dep-balance').textContent = '--'; return; }
    try {
      var res = await rpc('eth_call', [{ to: C.USDC_ADDRESS, data: encBalanceOf(state.account) }, 'latest']);
      $('dep-balance').textContent = fmtUsdc(BigInt(res)) + ' USDC';
    } catch (e) { $('dep-balance').textContent = 'error'; }
  }

  function updateEnable() {
    var amt = toBaseUnits(($('dep-amount').value || '').trim());
    var keyed = ($('dep-apikey').value || '').trim().length > 0;
    var enable = receiverStatus().ok && state.account && state.chainOk && amt && keyed;
    $('dep-send').disabled = !enable;
  }

  async function sendDeposit() {
    var amt = toBaseUnits(($('dep-amount').value || '').trim());
    var rs = receiverStatus();
    if (!rs.ok || !amt) return;
    $('dep-send').disabled = true;
    setStatus('Submitting USDC transfer — confirm in your wallet…', 'pending');
    var txHash;
    try {
      txHash = await rpc('eth_sendTransaction', [{
        from: state.account, to: C.USDC_ADDRESS, data: encTransfer(C.DEPOSIT_RECEIVING_WALLET, amt)
      }]);
    } catch (e) { setStatus('Transfer cancelled or failed: ' + (e && e.message || e), 'err'); $('dep-send').disabled = false; return; }

    var link = C.BASESCAN + '/tx/' + txHash;
    $('dep-txlink').innerHTML = 'Transaction: <a href="' + link + '" target="_blank" rel="noopener">' + txHash.slice(0, 18) + '… (BaseScan)</a>';
    show('dep-txlink', true);
    setStatus('Transaction submitted. Waiting for confirmations and crediting…', 'pending');
    await claim(txHash, 0);
  }

  // Backend is authoritative. Frontend NEVER credits locally. 202 = pending -> retry a few times.
  async function claim(txHash, attempt) {
    var key = ($('dep-apikey').value || '').trim();
    try {
      var r = await fetch(C.DEPOSIT_API_BASE + C.DEPOSIT_CLAIM_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
        body: JSON.stringify({ tx_hash: txHash })
      });
      var body = {}; try { body = await r.json(); } catch (e) {}
      if (r.status === 200 && body.ok) {
        setStatus('Credited ' + (body.credited_usd || '') + ' USDC to your account.', 'ok');
        await refreshBalance(); return;
      }
      if (r.status === 202 || (body && body.status === 'pending')) {
        setStatus('Confirming on-chain… (' + (body.confirmations != null ? body.confirmations : '?') + '/' + (body.required != null ? body.required : '?') + ' confirmations)', 'pending');
        if (attempt < 20) { setTimeout(function () { claim(txHash, attempt + 1); }, 15000); }
        else setStatus('Still confirming. Your deposit will credit once confirmed — you can safely re-check later.', 'pending');
        return;
      }
      if (r.status === 409 || (body && body.error === 'already_credited')) {
        setStatus('This deposit was already credited. No second credit was made.', 'ok'); return;
      }
      setStatus('Deposit not credited: ' + (body.error || ('HTTP ' + r.status)), 'err');
    } catch (e) { setStatus('Could not reach deposit service: ' + (e && e.message || e), 'err'); }
  }

  function init() {
    var rs = receiverStatus();
    if (!rs.ok) {
      show('dep-form', false); show('dep-unavailable', true);
      setStatus('Deposits temporarily unavailable', 'err');
      return;
    }
    $('dep-receiver').textContent = C.DEPOSIT_RECEIVING_WALLET;
    $('dep-usdc').textContent = C.USDC_ADDRESS;
    show('dep-form', true); show('dep-unavailable', false);
    $('dep-connect').addEventListener('click', connectWallet);
    $('dep-switch').addEventListener('click', switchChain);
    $('dep-send').addEventListener('click', sendDeposit);
    $('dep-amount').addEventListener('input', updateEnable);
    $('dep-apikey').addEventListener('input', updateEnable);
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('chainChanged', function () { ensureChain().then(refreshBalance).then(updateEnable); });
      window.ethereum.on('accountsChanged', function (a) { state.account = a && a[0]; $('dep-account').textContent = state.account || '--'; refreshBalance(); updateEnable(); });
    }
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
