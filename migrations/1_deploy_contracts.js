const VroomGame = artifacts.require("VroomGame");
const VRFConsumer = artifacts.require("VRFConsumer");
const VRFCoordinatorV2Mock = artifacts.require("VRFCoordinatorV2Mock");
const USDT = artifacts.require("USDT");

module.exports = async function (deployer, network, accounts) {
  // fill this per network
  let vrfCoordinatorAddress;
  let vrfKeyHash;
  let vrfSubscriptionId;

  if (network === 'test') {
    await deployer.deploy(VRFCoordinatorV2Mock, 100000, 100000);
    await deployer.deploy(USDT);

    vrfCoordinatorAddress = VRFCoordinatorV2Mock.address;
    vrfKeyHash = '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc';
    vrfSubscriptionId = 1;
  }

  await deployer.deploy(VRFConsumer, vrfSubscriptionId, vrfCoordinatorAddress, vrfKeyHash);
  await deployer.deploy(VroomGame, VRFConsumer.address, USDT.address);

  const vroomGame = await VroomGame.deployed();
  const vrfMock = await VRFCoordinatorV2Mock.deployed();
  const vrfConsumer = await VRFConsumer.deployed();

  if (network === 'test') {
    await vrfMock.createSubscription();
    await vrfMock.fundSubscription(1, "1000000000000000000");
    await vrfMock.addConsumer(1, vrfConsumer.address);
  }

  // set vroomGame as owner of vrfConsumer
  // so that vroomGame can generate random numbers
  await vrfConsumer.setOwner(vroomGame.address)
};
