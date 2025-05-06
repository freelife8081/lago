const SIDRA_RPC = "https://node.sidrachain.com";
const GRAPHQL_ENDPOINT = "https://corsproxy.io/?https://ledger.sidrachain.com/graphql";
const AIRDROP_RULES = [
  { min: 200_000, max: 500_000, airdrop: 15000 },
  { min: 501_000, max: 999_000, airdrop: 30000 },
  { min: 1_000_000, max: Infinity, airdrop: 70000 },
];
const balanceOfABI = [{
  constant: true,
  inputs: [{ name: "_owner", type: "address" }],
  name: "balanceOf",
  outputs: [{ name: "balance", type: "uint256" }],
  type: "function"
}];

async function fetchTokenHolders(tokenAddress) {
  const query = {
    query: `
      {
        tokenHolders(limit: 1000, tokenAddress: "${tokenAddress.toLowerCase()}") {
          holderAddress
          valueExact
        }
      }
    `
  };
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });
  const data = await res.json();
  return data.data?.tokenHolders || [];
}

async function checkAirdrop() {
  const tokenAddress = document.getElementById("tokenInput").value.trim();
  const output = document.getElementById("output");
  const status = document.getElementById("status");
  output.value = "";
  status.textContent = "Fetching token holders...";

  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    status.textContent = "Invalid contract address.";
    return;
  }

  try {
    const holders = await fetchTokenHolders(tokenAddress);
    if (!holders.length) {
      status.textContent = "No token holders found.";
      return;
    }

    const web3 = new Web3(new Web3.providers.HttpProvider(SIDRA_RPC));
    const contract = new web3.eth.Contract(balanceOfABI, tokenAddress);
    let results = [];

    status.textContent = `Checking ${holders.length} balances...`;

    for (const h of holders) {
      try {
        let balance = await contract.methods.balanceOf(h.holderAddress).call();
        balance = parseFloat(web3.utils.fromWei(balance));

        const rule = AIRDROP_RULES.find(r => balance >= r.min && balance <= r.max);
        if (rule) {
          results.push(`${h.holderAddress},${rule.airdrop}`);
        }
      } catch (err) {
        console.warn("Balance check failed for", h.holderAddress);
      }
    }

    if (results.length) {
      output.value = results.join("\n");
      status.textContent = `Found ${results.length} eligible addresses.`;
    } else {
      status.textContent = "No eligible addresses.";
    }

  } catch (err) {
    console.error(err);
    status.textContent = "Error fetching data.";
  }
}

function copyResults() {
  const output = document.getElementById("output");
  output.select();
  document.execCommand("copy");
  alert("Results copied to clipboard!");
}
