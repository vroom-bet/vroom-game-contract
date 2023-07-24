from vyper.interfaces import ERC20

interface VRFConsumerInterface:
  def requestRandomWords(): payable
  def getRandomNumber() -> uint256: view

event Deposit:
  player: address
  amount: uint256

event Withdraw:
  player: address
  amount: uint256

event Bet:
  player: address
  pick: uint256
  amount: uint256

event PickingClosed:
  round: uint256

event PickingOpened:
  round: uint256

event WinnerPicked:
  round: uint256
  winner: uint256

event PlayerWon:
  player: address
  amount: uint256

event PlayerLost:
  player: address
  amount: uint256

event DustCollected:
  amount: uint256

MAX_PLAYERS_PER_ROUND: constant(uint256) = 10_000

name: public(String[32])
balanceOf: public(HashMap[address, uint256])
usdtContract: public(ERC20)
owner: public(address)

currentRound: public(uint256)
lastRandomNumber: public(uint256)

roundPlayersPicks: public(HashMap[uint256, HashMap[address, uint256[4]]])
roundWinner: public(HashMap[uint256, uint256])
isPickingClosed: public(bool)

VRFConsumer: public(VRFConsumerInterface)

currentRoundPlayersCount: uint256
currentRoundPlayers: address[MAX_PLAYERS_PER_ROUND]

@external
def __init__(_vrfConsumerAddress: address, _usdtAddress: address):
  self.name = "VroomGame"
  self.owner = msg.sender
  self.currentRound = 0
  self.lastRandomNumber = 0
  self.currentRoundPlayersCount = 0
  self.isPickingClosed = True
  self.VRFConsumer = VRFConsumerInterface(_vrfConsumerAddress)
  self.usdtContract = ERC20(_usdtAddress)

@external
def deposit(_amount: uint256) -> bool:
  assert _amount > 0, "Deposit must be greater than 0"
  self.usdtContract.transferFrom(msg.sender, self, _amount)
  self.balanceOf[msg.sender] += _amount
  log Deposit(msg.sender, _amount)
  return True

@external
def withdraw(_amount: uint256) -> bool:
  assert _amount > 0, "Withdraw must be greater than 0"
  assert self.balanceOf[msg.sender] >= _amount, "Insufficient balance"
  self.balanceOf[msg.sender] -= _amount
  self.usdtContract.transfer(msg.sender, _amount)
  log Withdraw(msg.sender, _amount)
  return True

@external
def bet(_pick: uint256, _amount: uint256) -> bool:
  assert self.currentRound > 0, "Game has not started yet"
  assert self.isPickingClosed == False, "Round is closed"
  assert _pick >= 1 and _pick <= 4, "Pick must be between 1 and 4"
  assert _amount > 0, "Amount must be greater than 0"
  assert self.balanceOf[msg.sender] >= _amount, "Insufficient balance"

  if self._hasPlayerPicked(msg.sender) == False:
    self.currentRoundPlayers[self.currentRoundPlayersCount] = msg.sender
    self.currentRoundPlayersCount += 1

  # we pass _pick - 1, because the pick is 1 based but the array is 0 based
  self.roundPlayersPicks[self.currentRound][msg.sender][_pick - 1] += _amount
  self.balanceOf[msg.sender] -= _amount
  log Bet(msg.sender, _pick, _amount)

  return True

@external
def start() -> bool:
  assert msg.sender == self.owner, "Only owner can start a new round"
  assert self.currentRound == 0, "Game has already started"
  self.currentRound += 1
  self.isPickingClosed = False
  return True

@external
def closeRound() -> bool:
  assert msg.sender == self.owner, "Only owner can close a round"
  assert self.currentRound > 0, "Game has not started yet"
  assert self.isPickingClosed == False, "Round is already closed"
  self.isPickingClosed = True
  self.VRFConsumer.requestRandomWords()
  log PickingClosed(self.currentRound)
  return True

@external
def pickWinner() -> uint256:
  assert msg.sender == self.owner, "Only owner can pick a winner"
  assert self.currentRound > 0, "Game has not started yet"
  assert self.isPickingClosed == True, "Round is not closed yet"
  assert self.roundWinner[self.currentRound] == 0, "Winner has already been picked"

  randomNumber: uint256 = self.VRFConsumer.getRandomNumber()
  assert randomNumber != self.lastRandomNumber, "Chainlink VRF returned the same number"

  winner: uint256 = randomNumber % 4 + 1

  self.lastRandomNumber = randomNumber
  self.roundWinner[self.currentRound] = winner
  log WinnerPicked(self.currentRound, winner)

  # we need to credit the winners balances
  # we pass winner - 1, because the pick is 1 based but the array is 0 based
  self._creditWinners(winner - 1)

  # we only reset the `currentRoundPlayersCount`
  # because we will overide the `currentRoundPlayers` array when needed
  # this saves a lot of gas
  self.currentRoundPlayersCount = 0

  self.isPickingClosed = False
  self.currentRound += 1
  log PickingOpened(self.currentRound)

  return winner

@internal
def _hasPlayerPicked(_player: address) -> bool:
  arr: uint256[4] = self.roundPlayersPicks[self.currentRound][_player]
  return arr[0] > 0 or arr[1] > 0 or arr[2] > 0 or arr[3] > 0

@internal
def _creditWinners(winner: uint256) -> bool:
  # first we need to calculate the total amount of USDT in the winning picks
  # and the total amount of losers picks
  totalWinnersBetAmount: uint256 = 0
  totalLosersBetAMount: uint256 = 0

  for i in range(MAX_PLAYERS_PER_ROUND):
    # stop loop if we reached the end of number of players in this round
    if i >= self.currentRoundPlayersCount:
      break

    # sum the total amount of USDT in the winning picks
    player: address = self.currentRoundPlayers[i]
    playerPicks: uint256[4] = self.roundPlayersPicks[self.currentRound][player]
    totalWinnersBetAmount += playerPicks[winner]

    #  sum the total amount of USDT in the losers picks
    playerLosses: uint256 = 0

    for i2 in range(4):
      if i2 != winner:
        playerLosses += playerPicks[i2]

    if playerLosses > 0:
      totalLosersBetAMount += playerLosses
      log PlayerLost(player, playerLosses)

  totalCredited: uint256 = 0

  # now re-loop to credit the winners from their percentage of the losers picks
  for i in range(MAX_PLAYERS_PER_ROUND):
    if i >= self.currentRoundPlayersCount:
      break

    player: address = self.currentRoundPlayers[i]
    playerPicks: uint256[4] = self.roundPlayersPicks[self.currentRound][player]

    if playerPicks[winner] != 0:
      percentage: uint256 = playerPicks[winner] * 100 / totalWinnersBetAmount
      amountWon: uint256 = totalLosersBetAMount * percentage / 100
      amountToCredit: uint256 = playerPicks[winner] + amountWon
      totalCredited += amountWon
      self.balanceOf[player] += amountToCredit
      log PlayerWon(player, amountToCredit)

  # check if we have some left-overs
  if totalCredited < totalLosersBetAMount:
    dust: uint256 = totalLosersBetAMount - totalCredited
    self.balanceOf[self.owner] += dust
    log DustCollected(dust)

  return True
