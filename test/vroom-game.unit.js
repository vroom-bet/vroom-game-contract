const truffleAssert = require("truffle-assertions");

const VroomGame = artifacts.require("VroomGame");
const USDT = artifacts.require("USDT");

const VRFConsumer = artifacts.require("VRFConsumer");
const VRFMock = artifacts.require("VRFCoordinatorV2Mock");

const betAmount = web3.utils.BN(10 * 1e6);
const depositAmount = web3.utils.BN(100 * 1e6);

contract("VroomGame::Unit", ([owner, player]) => {
  it("should deploy and have right params", async () => {
    const vroomGame = await VroomGame.deployed();
    const usdt = await USDT.deployed();
    expect(await vroomGame.name()).to.equal("VroomGame");
    expect(await vroomGame.owner()).to.equal(owner);
    expect((await vroomGame.currentRound()).toString()).to.equal("0");
    expect(await vroomGame.usdtContract()).to.equal(usdt.address);
  });

  it("should not be able to withdraw before deposit", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.withdraw(betAmount, { from: player }),
      "Insufficient balance"
    );
  });

  it("should not be able to withdraw 0", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.withdraw(0, { from: player }),
      "Withdraw must be greater than 0"
    );
  });

  it("should not close round when game hasn't started", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.closeRound(),
      "Game has not started yet"
    );
  });

  it("should not allow to bet when game hasn't started", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.bet(0, betAmount),
      "Game has not started yet"
    );
  });

  it("should start the game", async () => {
    const vroomGame = await VroomGame.deployed();
    await vroomGame.start();
    expect((await vroomGame.currentRound()).toString()).to.equal("1");
  });

  it("should not allow to bet on picks out of range", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.bet(0, betAmount, { from: player }),
      "Pick must be between 1 and 4"
    );
    await truffleAssert.reverts(
      vroomGame.bet(5, betAmount, { from: player }),
      "Pick must be between 1 and 4"
    );
    await truffleAssert.reverts(
      vroomGame.bet(128123903, betAmount, { from: player }),
      "Pick must be between 1 and 4"
    );
  });

  it("should not allow to bet 0", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.bet(1, 0, { from: player }),
      "Amount must be greater than 0"
    );
  });

  it("should not allow to bet without deposit first", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.bet(1, betAmount, { from: player }),
      "Insufficient balance"
    );
  });

  it("should not allow to deposit 0", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.deposit(0, { from: player }),
      "Deposit must be greater than 0"
    );
  });

  it("should not allow to deposit before approval", async () => {
    const vroomGame = await VroomGame.deployed();
    await truffleAssert.reverts(
      vroomGame.deposit(depositAmount, { from: player })
    );
    expect((await vroomGame.balanceOf(player)).toString()).to.equal("0");
  });

  it("should allow to deposit", async () => {
    const vroomGame = await VroomGame.deployed();
    const usdt = await USDT.deployed();

    // transfer usdt to player
    const usdtBalance = await usdt.balanceOf(owner);
    await usdt.transfer(player, usdtBalance);

    // approve game contract to spend usdt from player
    // and call deposit on game contract
    await usdt.approve(vroomGame.address, usdtBalance.toString(), {
      from: player,
    });

    expect(usdtBalance.gt(depositAmount)).to.equal(true);
    await vroomGame.deposit(depositAmount, { from: player });

    expect((await vroomGame.balanceOf(player)).toString()).to.equal(
      depositAmount.toString()
    );
    expect((await usdt.balanceOf(player)).toString()).to.equal(
      usdtBalance.sub(depositAmount).toString()
    );
    expect((await usdt.balanceOf(vroomGame.address)).toString()).to.equal(
      depositAmount.toString()
    );
  });

  it("should not allow to bet more than deposited", async () => {
    const vroomGame = await VroomGame.deployed();
    const doubleDepositAmount = depositAmount.mul(web3.utils.toBN(2));
    await truffleAssert.reverts(
      vroomGame.bet(1, doubleDepositAmount, { from: player }),
      "Insufficient balance"
    );
  });

  it("should allow to bet", async () => {
    const vroomGame = await VroomGame.deployed();
    await vroomGame.bet(1, betAmount, { from: player });

    expect((await vroomGame.balanceOf(player)).toString()).to.equal(
      depositAmount.sub(betAmount).toString()
    );
  });

  it("should allow to bet again", async () => {
    const vroomGame = await VroomGame.deployed();
    await vroomGame.bet(2, betAmount, { from: player });
    expect((await vroomGame.balanceOf(player)).toString()).to.equal(
      depositAmount.sub(betAmount.mul(web3.utils.toBN(2))).toString()
    );
  });

  it("should allow to bet on same pick", async () => {
    const vroomGame = await VroomGame.deployed();
    await vroomGame.bet(1, betAmount, { from: player });
    expect((await vroomGame.balanceOf(player)).toString()).to.equal(
      depositAmount.sub(betAmount.mul(web3.utils.toBN(3))).toString()
    );
  });

  it("should be able to withdraw", async () => {
    const vroomGame = await VroomGame.deployed();
    const usdt = await USDT.deployed();

    const beforeUSDTBalance = await usdt.balanceOf(player);
    const beforeGameBalance = await vroomGame.balanceOf(player);
    await vroomGame.withdraw(betAmount, { from: player });

    const afterGameBalance = await vroomGame.balanceOf(player);
    expect(afterGameBalance.toString()).to.equal(
      beforeGameBalance.sub(betAmount).toString()
    );

    expect((await usdt.balanceOf(player)).toString()).to.equal(
      beforeUSDTBalance.add(betAmount).toString()
    );
  });

  it("should close round and stop allowing picks", async () => {
    const vroomGame = await VroomGame.deployed();
    expect(await vroomGame.isPickingClosed()).to.equal(false);

    await truffleAssert.reverts(
      vroomGame.closeRound({ from: player }),
      "Only owner can close a round"
    );

    await vroomGame.closeRound();
    expect(await vroomGame.isPickingClosed()).to.equal(true);

    await truffleAssert.reverts(
      vroomGame.bet(1, betAmount, { from: player }),
      "Round is closed"
    );

    await truffleAssert.reverts(
      vroomGame.closeRound(),
      "Round is already closed"
    );
  });

  it("should pick race winner using Chainlink VRF", async () => {
    const vroomGame = await VroomGame.deployed();

    const currentRound = await vroomGame.currentRound();
    const roundWinner = await vroomGame.roundWinner(currentRound);

    expect(roundWinner.toString()).to.equal("0");
    expect(await vroomGame.isPickingClosed()).to.equal(true);

    await truffleAssert.reverts(
      vroomGame.pickWinner({ from: player }),
      "Only owner can pick a winner"
    );

    // MOCK VRF RESPONSE FROM CHAINLINK
    // REQUEST WAS SENT FROM `closeRound` FUNCTION

    const vrfMock = await VRFMock.deployed();
    const vrfConsumer = await VRFConsumer.deployed();

    const requestId = await vrfConsumer.s_requestId();
    await vrfMock.fulfillRandomWords(requestId, vrfConsumer.address);

    await vroomGame.pickWinner();

    const roundWinnerAfter = await vroomGame.roundWinner(currentRound);
    expect(roundWinnerAfter.toString()).to.not.equal("0");

    const currentRoundAfter = await vroomGame.currentRound();
    expect(currentRoundAfter.toString()).to.equal(
      currentRound.add(web3.utils.toBN(1)).toString()
    );

    expect(await vroomGame.isPickingClosed()).to.equal(false);
  });

  it("should allow players to bet for next round", async () => {
    const vroomGame = await VroomGame.deployed();
    const beforeBalance = await vroomGame.balanceOf(player);
    await vroomGame.bet(1, betAmount, { from: player });
    const afterBalance = await vroomGame.balanceOf(player);
    expect(afterBalance.toString()).to.equal(
      beforeBalance.sub(betAmount).toString()
    );
  });

  it("should not pick winner if round is not closed", async () => {
    const vroomGame = await VroomGame.deployed();
    expect(await vroomGame.isPickingClosed()).to.equal(false);
    await truffleAssert.reverts(
      vroomGame.pickWinner(),
      "Round is not closed yet"
    );
  });
});
