import fs from 'fs'
import solc from 'solc'
import linker from 'solc/linker'
import Ganache from 'ganache-core'
import Web3 from 'web3'

var solcOpts = {
  language: 'Solidity',
  settings: {
    metadata: { useLiteralContent: true },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object']
      }
    }
  }
}

// Instantiate a web3 instance. Start a node if one is not already running.
export async function web3Helper(provider = 'ws://localhost:7545') {
  var web3 = new Web3(provider)
  await server(web3, provider)
  return web3
}

function findImports(path) {
  try {
    return {
      contents: fs
        .readFileSync(__dirname + '/../contracts/' + path)
        .toString()
    }
  } catch (e) {
    return { error: 'File not found' }
  }
}

export default async function testHelper(contracts) {
  const web3 = await web3Helper()
  const accounts = await web3.eth.getAccounts()

  async function deploy(contractName, { from, args }) {
    var sources = {
      [contractName]: {
        content: fs.readFileSync(`${contracts}/${contractName}.sol`).toString()
      }
    }
    var compileOpts = JSON.stringify({ ...solcOpts, sources })

    // Compile the contract using solc
    var rawOutput = solc.compileStandardWrapper(compileOpts, findImports)
    var output = JSON.parse(rawOutput)

    // If there were any compilation errors, throw them
    if (output.errors) {
      var error = output.errors[0]
      throw new SyntaxError(error.formattedMessage)
    }

    // Instantiate the web3 contract using the abi and bytecode output from solc
    var { abi, evm: { bytecode } } = output.contracts[contractName][
      contractName
    ]

    // Deploy linked libraries
    for (let linkedFile in bytecode.linkReferences) {
      for (let linkedLib in bytecode.linkReferences[linkedFile]) {
        let libObj = output.contracts[linkedFile][linkedLib]
        let LibContract = new web3.eth.Contract(libObj.abi)
        var libContract = await LibContract.deploy({
          data: libObj.evm.bytecode.object
        }).send({
          from,
          gas: 3000000
        })

        let libs = { [`${linkedFile}:${linkedLib}`]: libContract._address }

        bytecode.object = linker.linkBytecode(bytecode.object, libs)
      }
    }

    if (!bytecode.object) {
      throw new Error(
        'No Bytecode. Do the method signatures match the interface?'
      )
    }

    var Contract = new web3.eth.Contract(abi)

    var contract = await Contract.deploy({
      data: bytecode.object,
      arguments: args
    }).send({ from, gas: 4000000 })

    // Set some default options on the contract
    contract.options.gas = 1500000
    contract.options.from = from

    return contract
  }

  return { web3, accounts, deploy }
}

// Start the server if it hasn't been already...
async function server(web3, provider) {
  try {
    // Hack to prevent "connection not open on send" error when using websockets
    web3.setProvider(provider.replace(/^ws/, 'http'))
    await web3.eth.net.getId()
    web3.setProvider(provider)
    return
  } catch (e) {
    /* Ignore */
  }

  var port = provider ? provider.match(/:([0-9]+)$/)[1] : '7545'
  await Ganache.server().listen(port)
}
