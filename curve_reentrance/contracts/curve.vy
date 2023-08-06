event AddLiquidity:
    excuted: uint256

event RemoveLiquidity:
    excuted: uint256

deployer: address

@external
def __init__():
    self.deployer = msg.sender

@external
@view
def isOwner(user: address) -> bool:
    return user == self.deployer

@external
@nonreentrant('lock')
def add_liquidity():
    log AddLiquidity(1)

@external
@nonreentrant('lock')
def remove_liquidity():
    raw_call(msg.sender, b"")
    log RemoveLiquidity(1)
