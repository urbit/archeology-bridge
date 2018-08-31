# bridge

bridge is a fork of [MyEtherWallet](https://www.MyEtherWallet.com) that allows
you to manage various aspects of your Urbit ships, such as launching, transferring, issuing, and voting through the Urbit constitution, a PKI and identity system implemented as an Ethereum smart contract.

## Development

### Overview

Running bridge in development involves starting up an RPC-enabled Ethereum node (`ganache`) and deploying the Urbit constitution smart contracts (`truffle`) to that test network.

To run bridge, build the application and open the generated `dist/index.html` in a browser.

### Dependencies

- `node.js`
- `truffle`
- `ganache-cli`
- urbit/constitution
- urbit/constitution-js

### Suggested Workflow

You'll need to clone the following three respositories:

- [urbit/bridge](https://github.com/urbit/bridge)
- [urbit/constitution](https://github.com/urbit/constitution)
- [urbit/constitution-js](https://github.com/urbit/constitution-js)

You’ll also need 3 terminal windows open for the following processes:

- `ganache` (run local Ethereum node)
- `truffle` (compile and deploy contracts)
- `npm` (build bridge)

### Install & Run

#### Install truffle & ganache
- `npm install -g truffle`
- `npm install -g ganache-cli`

#### Clone constitution
- `git clone https://github.com/urbit/constitution`
- `cd constitution`
- `npm install`

#### Clone bridge
- `git clone https://github.com/urbit/bridge`
- `cd bridge`
- `npm install`

#### Clone constitution-js
- `git clone https://github.com/urbit/constitution-js`
- `npm install`

#### Link constitution-js
- `cd constitution-js`
- `npm link`
- `cd bridge`
- `npm link ../constitution-js`

#### Launch node & deploy contracts
- `ganache-cli -m "benefit crew supreme gesture quantum web media hazard theory mercy wing kitten"` (in its own terminal window)
- `cd constitution`
- `truffle deploy`

#### Launch bridge
- `npm run dev`
- open `bridge/dist/index.html` in a browser (tested on Chrome)

In order to test with Ledger or Metamask, you must run a server:

- `cd bridge`
- `python ./dist/bin/serve.py`

### Useful addresses
- Constitution owner (allowed to create galaxies): `0x6deffb0cafdb11d175f123f6891aa64f01c24f7d`
- Test pool: `0x0724ee9912836c2563eee031a739dda6dd775333`

## Running bridge locally

### Unlocking

To unlock the test wallet, choose "Mnemonic" as your method and enter the mnemonic `benefit crew supreme gesture quantum web media hazard theory mercy wing kitten`

### Connecting

To connect to your test network, click the Node indicator in the header (defaults to ETH). Click through the wizard to set up a custom node, using the placeholders for each field.

### Online mode

The "State" screen of bridge will show a list of ships that you own, along with actions available for that Ship. It will also allow you to connect to a Pool, which is an exchange for exchanging Stars for Spark Tokens and vice versa. If a Pool is connected, you will see your address' Spark balance.

<div style="text-align: center">
  <img src="./app/images/muw_state_border.png" width="50%"/>
</div>
<br/>

Below each ship, you will see a list of actions that corresponds to that ship's type (Galaxy, Star, Planet) and state (Locked or Living). In the default online mode
clicking on an action will take you to a transaction screen, where you will be asked to provide additional information for that transaction. For example, if you'd like to launch a child ship, say a planet from your star, then you will be asked which address the new ship should belong to and how long (in seconds) the ship should be
locked before it can be started.

Once you've filled out the appropriate fields, you will be able to "Create" a transaction. This does not send the transaction to the blockchain, but merely creates and signs the transaction. The display will show both the signed and unsigned transactions for approval. Once you've created a transaction, you can press "Send," which will send the transaction to the Ethereum node to which your wallet is connected and you'll be shown a confirmation (or warning) dialogue, giving you the hash of the transaction.

When you're done, you can navigate back to the State screen to execute other transactions.

<div style="text-align: center">
  <img src="./app/images/muw_launch_border.png" width="50%"/>
</div>
<br/>

### Offline Mode

If you'd prefer to construct your transactions offline, click on the node indicator in the header and select "Offline." This will disconnect Wallet from the node.

In offline mode, all transactions are listed and available. The transaction screens are identical, execept that nonce, gasLimit and gasPrice have to be entered manually (because these estimations require a node). Once you've filled the transaction fields, clicking "Create" will create and sign your transaction. At this point, you should copy and paste your transaction into another client to send to a node.

In offline mode, there is no validation of your transaction parameters, and there is no way to submit a transaction directly to a node. If you select this mode, you should have another way to submit transactions to the chain and you should independently confirm that your transaction is valid. For example, if you create a "Launch Child" transaction offline, please make sure that you own the parent ship. Refer to [the constitution](https://github.com/urbit/constitution) for the constraints on each transaction.
