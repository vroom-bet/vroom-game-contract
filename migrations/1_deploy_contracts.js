const Vroom = artifacts.require("Vroom");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(Vroom);
};
