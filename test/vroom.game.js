const Vroom = artifacts.require("Vroom");

contract("Vroom::Game", (accounts) => {
  it("should deploy ", async () => {
    await Vroom.deployed();
  });
});
