// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// WE NEED THIS DUMMY FILE FOR TRUFFLE TO WORK PROPERLY WITH VYPER
// OTHERWISE ARTIFACTS WILL NOT BE GENERATED PROPERLY

contract Migrations {
    address public owner;
    uint public last_completed_migration;

    constructor() {
        owner = msg.sender;
    }

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    function setCompleted(uint completed) public restricted {
        last_completed_migration = completed;
    }
}
