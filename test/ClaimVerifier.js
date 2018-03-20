import assert from 'assert'
import helper from './_helper'

describe('ClaimVerifier', async function() {
  var web3, accounts, deploy, prvSigner, pubSigner
  var UserIdentity, ClaimVerifier, IdentityVerifier

  before(async function() {
    ({ deploy, accounts, web3 } = await helper(
      `${__dirname}/../contracts`
    ))

    prvSigner = web3.utils.randomHex(32)
    pubSigner = web3.eth.accounts.privateKeyToAccount(prvSigner).address

    UserIdentity = await deploy('ClaimHolder', { from: accounts[0] })
    IdentityVerifier = await deploy('ClaimHolder', { from: accounts[1] })
    ClaimVerifier = await deploy('ClaimVerifier', { from: accounts[2], args: [
      IdentityVerifier._address
    ] })
  })

  it('should allow trusted identifier to execute addKey', async function() {
    var key = web3.utils.sha3(pubSigner)
    var abi = await IdentityVerifier.methods.addKey(key, 1, 1).encodeABI()

    var getRes1 = await IdentityVerifier.methods.getKey(key).call()
    assert.equal(getRes1[0], 0)

    await IdentityVerifier.methods
      .execute(IdentityVerifier.options.address, 0, abi)
      .send({ from: accounts[1] })

    var getRes = await IdentityVerifier.methods.getKey(key).call()
    assert.deepEqual(getRes[0], '1')
  })

  it('should not allow new listing without identity claim', async function() {
    var res = await ClaimVerifier.methods
      .checkClaim(UserIdentity._address, 3)
      .send({ from: accounts[0] })
    assert(res.events.ClaimInvalid)
  })

  it('should allow Verifier to post a claim to User identity via execute', async function() {
    var data = '{ "did": "did:facebook:12345" }'
    var signed = await web3.eth.accounts.sign(data, prvSigner)

    var abi = await UserIdentity.methods
      .addClaim(
        3,
        2,
        IdentityVerifier._address,
        signed.signature,
        signed.messageHash,
        'abc.com'
      )
      .encodeABI()

    var res = await UserIdentity.methods
      .execute(UserIdentity.options.address, 0, abi)
      .send({ from: accounts[2] })

    var execId = res.events.ExecutionRequested.returnValues.executionId

    var approveRes = await UserIdentity.methods.approve(execId, true).send({
      from: accounts[0]
    })

    assert(approveRes.events.ClaimAdded)
  })

  it('should now validate claim successfully', async function() {
    var res = await ClaimVerifier.methods
      .checkClaim(UserIdentity._address, 3)
      .send({ from: accounts[0] })
    assert(res.events.ClaimValid)
  })
})
