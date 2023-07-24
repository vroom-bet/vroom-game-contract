const VroomGame = artifacts.require("VroomGame");
const VRFConsumer = artifacts.require("VRFConsumer");
const VRFCoordinatorV2Mock = artifacts.require("VRFCoordinatorV2Mock");
const USDT = artifacts.require("USDT");

module.exports = async function (deployer, network, accounts) {
  // fill this per network
  let vrfCoordinatorAddress;
  let vrfKeyHash;
  let vrfSubscriptionId;

  let usdtAddress;

  if (network === "test" || network.startsWith("development")) {
    await deployer.deploy(VRFCoordinatorV2Mock, 100000, 100000);
    vrfCoordinatorAddress = VRFCoordinatorV2Mock.address;
    vrfKeyHash =
      "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
    vrfSubscriptionId = 1;
  }

  if (network.startsWith('sepolia')) {
    vrfCoordinatorAddress = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
    vrfKeyHash =
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
    vrfSubscriptionId = 3895;
  }

  if (
    network === "test" ||
    network.startsWith('sepolia') ||
    network.startsWith("development")
  ) {
    await deployer.deploy(USDT);
    const usdt = await USDT.deployed();
    usdtAddress = usdt.address;
  }

  if (!vrfSubscriptionId) throw new Error("vrfSubscriptionId not set");
  if (!vrfCoordinatorAddress) throw new Error("vrfCoordinatorAddress not set");
  if (!vrfKeyHash) throw new Error("vrfKeyHash not set");
  if (!usdtAddress) throw new Error("usdtAddress not set");

  await deployer.deploy(
    VRFConsumer,
    vrfSubscriptionId,
    vrfCoordinatorAddress,
    vrfKeyHash
  );
  await deployer.deploy(VroomGame, VRFConsumer.address, usdtAddress);

  const vroomGame = await VroomGame.deployed();
  const vrfConsumer = await VRFConsumer.deployed();

  if (network === "test") {
    const vrfMock = await VRFCoordinatorV2Mock.deployed();
    await vrfMock.createSubscription();
    await vrfMock.fundSubscription(1, "1000000000000000000");
    await vrfMock.addConsumer(1, vrfConsumer.address);
  }

  // set vroomGame as owner of vrfConsumer
  // so that vroomGame can generate random numbers
  await vrfConsumer.setOwner(vroomGame.address);
};
