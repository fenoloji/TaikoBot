require('dotenv').config();
const { getWeb3, walletAddress, switchRpc } = require('./config/web3');
const { wrap } = require('./src/module/wrap/wrap');
const { unwrap } = require('./src/module/wrap/unwrap');
const BN = require('bn.js');
let firstRun = true;
let transactionsPerDay = 130;
let transactionsPerHour = 7;
let remainDelay = 6000;
let remainHour = 0;
                                                                                                                                         
function randomGasPrice(web3Instance) {
    const minGwei = new BN(web3Instance.utils.toWei('0.05', 'gwei'));
    const maxGwei = new BN(web3Instance.utils.toWei('0.054', 'gwei'));
    const randomGwei = minGwei.add(new BN(Math.floor(Math.random() * (maxGwei.sub(minGwei).toNumber()))));
    return randomGwei;
}

async function getNonce(web3Instance, walletAddress) {
    return await web3Instance.eth.getTransactionCount(walletAddress, 'pending');
}

async function executeTransaction(action, gasPriceWei, iterationCount, ...args) {
    let web3Instance = getWeb3();
    while (true) {
        try {
            const gasLimit = new BN(100000);
            const totalTxCost = gasLimit.mul(new BN(gasPriceWei));
            const balanceWei = await web3Instance.eth.getBalance(walletAddress);
            const balance = new BN(balanceWei);

            if (balance.lt(totalTxCost)) {
                console.log(` Insufficient funds to cover the transaction cost. Transaction skipped.`);
                return;
            }

            const localNonce = await getNonce(web3Instance, walletAddress);
            return await action(...args, gasPriceWei.toString(), localNonce);
        } catch (error) {
            console.error(` Transaction ${iterationCount + 1}: Error executing transaction: ${error.message}`);
            if (error.message.includes("Invalid JSON RPC response")) {
                console.log("Retrying...");
                web3Instance = switchRpc(); 
            } else if (error.message.includes("nonce too low")) {
                console.log("Nonce too low, retrying with new nonce...");
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000)); 
            }
        }
    }
}

async function main() {
  while (true) {
    //Programın rastgele bir zamanda başlaması için görev zamanlayıcısı başlattıktan sonra 1 saat içerisinde rastgele başlaması amaçlanıyor
    const initialDelay = Math.floor(Math.random() * 3600000); // Random delay up to 1 hour
    console.log(`Initial delay of ${initialDelay / 1000} seconds before starting transactions.`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));
 
    transactionsPerDay = Math.floor(Math.random() * 11) + 130; // Random number between 130 and 140
    transactionsPerHour = Math.floor(transactionsPerDay / 20); // Spread transactions over 20 hours
 


    let iterationCount = 0;

    // Generate a random start hour for the 4-hour pause window (UTC hour 0-19)
    const pauseStartHour = Math.floor(Math.random() * 20);

    while (iterationCount < transactionsPerDay) {
        const currentHourUTC = new Date().getUTCHours();

        // Check if current hour is within the 4-hour pause window
        const isWithinPauseWindow = currentHourUTC >= pauseStartHour && currentHourUTC < (pauseStartHour + 4) % 24;

        if (!isWithinPauseWindow) {
            const web3Instance = getWeb3();
            const gasPriceWei = randomGasPrice(web3Instance);

            const balanceWei = await web3Instance.eth.getBalance(walletAddress);
            const balance = new BN(balanceWei);
            const gasLimit = new BN(500000); 
            const totalTxCost = gasLimit.mul(gasPriceWei);

            console.log(`Gas Limit: ${gasLimit.toString()}, Gas Price: ${web3Instance.utils.fromWei(gasPriceWei, 'gwei')} Gwei`);
            console.log(`Total Tx Cost: ${web3Instance.utils.fromWei(totalTxCost.toString(), 'ether')} ETH`);

            if (balance.lt(totalTxCost)) {
                console.log(`: Insufficient funds to cover the transaction cost. Transaction skipped.`);
                break;
            }

            // Wrap
            const wrapAmountMin = 0.0003;
            const wrapAmountMax = 0.0004;
            let wrapAmount = Math.random() * (wrapAmountMax - wrapAmountMin) + wrapAmountMin;
            wrapAmount = parseFloat(wrapAmount.toFixed(6));
            let txHash = await executeTransaction(wrap, gasPriceWei,iterationCount, wrapAmount);
            if (!txHash) break;
            let txLink = `https://taikoscan.io/tx/${txHash}`;

            console.log(` Transaction ${iterationCount + 1}`);
            console.log(` Wrap Transaction sent: ${txLink}, Amount: ${wrapAmount} ETH`);
            console.log('\x1b[42m%s\x1b[0m',`--------------------------------------------------------------`);
          
            // Random delay before Unwrap
            const waitTime = Math.floor(3600 / transactionsPerHour * 1000);
            const randomDelay = Math.floor(Math.random() * waitTime); // Random delay up to waitTime
            console.log(` Waiting ${randomDelay / 1000} seconds before Unwrap.`);
            console.log(`\x1b[43m%s\x1b[0m`,` Kalan transaction sayısı ${transactionsPerDay - iterationCount}`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));

            // Unwrap
            iterationCount++;
            txHash = await executeTransaction(unwrap, gasPriceWei, iterationCount, wrapAmount);
            if (!txHash) break;
            console.log(`Transaction ${iterationCount + 1}`);
            console.log(` Unwrap Transaction sent: https://taikoscan.io/tx/${txHash}`);
            console.log('\x1b[42m%s\x1b[0m',`--------------------------------------------------------------`);
            iterationCount++;
            remainDelay = waitTime - randomDelay + waitTime;
            console.log(`Transaction ${iterationCount + 1}: Waiting for ${remainDelay / 1000} seconds before the next transaction.`);
            await new Promise(resolve => setTimeout(resolve, remainDelay));
        } else {
            console.log(` Transactions skipped during the UTC hour ${currentHourUTC}.`);
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
      
    }
     console.log(`Completed ${transactionsPerDay} iterations.`);
     }
    //Bugünlük tx ler yapıldı yarın için uykuya dal
    const zzzz = 60000 * 60 * 24;
    await new Promise(resolve => setTimeout(resolve, zzzz));
  }


main().catch(console.error);
