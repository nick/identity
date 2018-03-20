pragma solidity ^0.4.18;

import './ERC735.sol';
import './KeyHolder.sol';

contract ClaimHolder is KeyHolder, ERC735 {

    bytes32 claimId;
    mapping (bytes32 => Claim) claims;
    mapping (uint256 => bytes32[]) claimsByType;

    function addClaim(
        uint256 _claimType,
        uint256 _scheme,
        address _issuer,
        bytes _signature,
        bytes32 _data,
        string _uri
    )
        public
        returns (bytes32 claimRequestId)
    {
        claimId = keccak256(_issuer, _claimType);
        KeyHolder issuer = KeyHolder(issuer);

        if (msg.sender != address(this)) {
           require(keyHasPurpose(keccak256(msg.sender), 3));
        }

        if (claims[claimId].issuer != _issuer) {
            claimsByType[_claimType].push(claimId);
        }

        claims[claimId].claimType = _claimType;
        claims[claimId].scheme = _scheme;
        claims[claimId].issuer = _issuer;
        claims[claimId].signature = _signature;
        claims[claimId].data = _data;
        claims[claimId].uri = _uri;

        emit ClaimAdded(
            claimId,
            _claimType,
            _scheme,
            _issuer,
            _signature,
            _data,
            _uri
        );

        return claimId;
    }

    function removeClaim(bytes32 _claimId) public returns (bool success) {
        require(
            msg.sender == claims[_claimId].issuer ||
            msg.sender == address(this)
        );

        emit ClaimRemoved(
            _claimId,
            claims[_claimId].claimType,
            claims[_claimId].scheme,
            claims[_claimId].issuer,
            claims[_claimId].signature,
            claims[_claimId].data,
            claims[_claimId].uri
        );

        delete claims[_claimId];
        return true;
    }

    function getClaim(bytes32 _claimId)
        public
        constant
        returns(
            uint256 claimType,
            uint256 scheme,
            address issuer,
            bytes signature,
            bytes32 data,
            string uri
        )
    {
        return (
            claims[_claimId].claimType,
            claims[_claimId].scheme,
            claims[_claimId].issuer,
            claims[_claimId].signature,
            claims[_claimId].data,
            claims[_claimId].uri
        );
    }

    function getClaimSig(bytes32 _claimId)
        public
        constant
        returns(
          bytes32 data,
          bytes32 r,
          bytes32 s,
          uint8 v
        )
    {
        bytes32 ra;
        bytes32 sa;
        uint8 va;

        bytes memory sig = claims[_claimId].signature;
        bytes32 claimData = claims[_claimId].data;

        // Check the signature length
        if (sig.length != 65) {
          return (0, 0, 0, 0);
        }

        // Divide the signature in r, s and v variables
        assembly {
          ra := mload(add(sig, 32))
          sa := mload(add(sig, 64))
          va := byte(0, mload(add(sig, 96)))
        }

        if (va < 27) {
          va += 27;
        }

        return (claimData, ra, sa, va);
    }

    function getClaimIdsByType(uint256 _claimType)
        public
        constant
        returns(bytes32[] claimIds)
    {
        return claimsByType[_claimType];
    }

}
