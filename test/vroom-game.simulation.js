const VroomGame = artifacts.require("VroomGame");
const USDT = artifacts.require("USDT");
const VRFConsumer = artifacts.require("VRFConsumer");
const VRFMock = artifacts.require("VRFCoordinatorV2Mock");

const depositAmount = web3.utils.BN(1000 * 1e6);
const betAmount = web3.utils.BN(10 * 1e6);

const taxWallet = "0x00357AeAD4fd588339a9E5aEA411F0356d085FbB";

contract(
  "VroomGame::Simulation",
  ([owner, playerA, playerB, playerC, playerD, godfather]) => {
    before(async () => {
      const vroomGame = await VroomGame.deployed();
      const usdt = await USDT.deployed();

      // distribute USDT to players
      await usdt.transfer(playerA, depositAmount);
      await usdt.transfer(playerB, depositAmount);
      await usdt.transfer(playerC, depositAmount);
      await usdt.transfer(playerD, depositAmount);

      // approve USDT to vroomGame
      await usdt.approve(vroomGame.address, depositAmount, { from: playerA });
      await usdt.approve(vroomGame.address, depositAmount, { from: playerB });
      await usdt.approve(vroomGame.address, depositAmount, { from: playerC });
      await usdt.approve(vroomGame.address, depositAmount, { from: playerD });

      // deposit USDT to vroomGame
      await vroomGame.methods['deposit(uint256,address)'](depositAmount, godfather, { from: playerA });
      await vroomGame.methods['deposit(uint256,address)'](depositAmount, godfather, { from: playerB });
      await vroomGame.methods['deposit(uint256,address)'](depositAmount, godfather, { from: playerC });
      await vroomGame.methods['deposit(uint256,address)'](depositAmount, godfather, { from: playerD });

      // start the game
      await vroomGame.start();
    });

    it("should have correct players balance", async () => {
      const vroomGame = await VroomGame.deployed();
      expect((await vroomGame.balanceOf(playerA)).toString()).to.equal(
        depositAmount.toString()
      );
      expect((await vroomGame.balanceOf(playerB)).toString()).to.equal(
        depositAmount.toString()
      );
      expect((await vroomGame.balanceOf(playerC)).toString()).to.equal(
        depositAmount.toString()
      );
      expect((await vroomGame.balanceOf(playerD)).toString()).to.equal(
        depositAmount.toString()
      );
    });

    it("should let players bet", async () => {
      const vroomGame = await VroomGame.deployed();
      await vroomGame.bet(1, betAmount, { from: playerA });
      await vroomGame.bet(2, betAmount, { from: playerA });
      await vroomGame.bet(1, betAmount, { from: playerB });
      await vroomGame.bet(2, betAmount, { from: playerB });
      await vroomGame.bet(3, betAmount, { from: playerC });
      await vroomGame.bet(1, betAmount, { from: playerC });
      await vroomGame.bet(2, betAmount, { from: playerC });
      await vroomGame.bet(4, betAmount, { from: playerD });
      await vroomGame.bet(3, betAmount, { from: playerD });
    });

    it("should close round", async () => {
      const vroomGame = await VroomGame.deployed();
      await vroomGame.closeRound();
      expect(await vroomGame.isPickingClosed()).to.equal(true);
    });

    it("should pick winners", async () => {
      const vroomGame = await VroomGame.deployed();
      // MOCK VRF RESPONSE FROM CHAINLINK
      // REQUEST WAS SENT FROM `closeRound` FUNCTION

      const vrfMock = await VRFMock.deployed();
      const vrfConsumer = await VRFConsumer.deployed();

      const requestId = await vrfConsumer.s_requestId();
      await vrfMock.fulfillRandomWords(requestId, vrfConsumer.address);

      await vroomGame.pickWinner();
      expect(await vroomGame.isPickingClosed()).to.equal(false);
    });

    it("should have same inner balance than usdt balance", async () => {
      const vroomGame = await VroomGame.deployed();
      const usdt = await USDT.deployed();

      // tax + dust
      const taxWalletBalance = await vroomGame.balanceOf(taxWallet);
      // godfather
      const godfatherBalance = await vroomGame.balanceOf(godfather);
      // players
      const playerABalance = await vroomGame.balanceOf(playerA);
      const playerBBalance = await vroomGame.balanceOf(playerB);
      const playerCBalance = await vroomGame.balanceOf(playerC);
      const playerDBalance = await vroomGame.balanceOf(playerD);
      // contract balance
      const usdtBalance = await usdt.balanceOf(vroomGame.address);

      expect(
        playerABalance
          .add(playerBBalance)
          .add(playerCBalance)
          .add(playerDBalance)
          .add(taxWalletBalance)
          .add(godfatherBalance)
          .toString()
      ).to.equal(usdtBalance.toString());
    });

    it("should allow players to withdraw", async () => {
      const vroomGame = await VroomGame.deployed();
      const usdt = await USDT.deployed();

      const playerABalance = await vroomGame.balanceOf(playerA);
      await vroomGame.withdraw(playerABalance, { from: playerA });
      const playerBBalance = await vroomGame.balanceOf(playerB);
      await vroomGame.withdraw(playerBBalance, { from: playerB });
      const playerCBalance = await vroomGame.balanceOf(playerC);
      await vroomGame.withdraw(playerCBalance, { from: playerC });
      const playerDBalance = await vroomGame.balanceOf(playerD);
      await vroomGame.withdraw(playerDBalance, { from: playerD });

      expect((await vroomGame.balanceOf(playerA)).toString()).to.equal("0");
      expect((await vroomGame.balanceOf(playerB)).toString()).to.equal("0");
      expect((await vroomGame.balanceOf(playerC)).toString()).to.equal("0");
      expect((await vroomGame.balanceOf(playerD)).toString()).to.equal("0");

      expect((await usdt.balanceOf(playerA)).toString()).to.equal(
        playerABalance.toString()
      );
      expect((await usdt.balanceOf(playerB)).toString()).to.equal(
        playerBBalance.toString()
      );
      expect((await usdt.balanceOf(playerC)).toString()).to.equal(
        playerCBalance.toString()
      );
      expect((await usdt.balanceOf(playerD)).toString()).to.equal(
        playerDBalance.toString()
      );
    });

    it("should have distributed USDT to tax wallet", async () => {
      const vroomGame = await VroomGame.deployed();
      const ownerBalance = await vroomGame.balanceOf(taxWallet);
      expect(ownerBalance.toString()).to.not.equal("0");
    });
  }
);
