


const { ethers, BigNumber } = require('ethers');
const fs = require('fs');
const {tokens} = require('../src/global.config');
const { normalize, getConfTokenBySymbol } = require('../src/utils/token.utils');
const path = require('path');
const dotenv = require('dotenv');
const { computeUniswapV2Price, computeLiquidityUniV2Pool, getUniV2DataFile } = require('../src/uniswap.v2/uniswap.v2.utils');
dotenv.config();
const axios = require('axios');
const { get_return, computeLiquidityForSlippageCurvePool } = require('../src/curve/curve.utils');
const { logFnDuration } = require('../src/utils/utils');
const { getUniV3DataFiles, getUniV3DataContents } = require('../src/uniswap.v3/uniswap.v3.utils');
const util = require('util');
const { exec } = require('child_process');

const execAsync = util.promisify(exec);



const erc20Abi = [{'inputs':[{'internalType':'uint256','name':'chainId_','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'src','type':'address'},{'indexed':true,'internalType':'address','name':'guy','type':'address'},{'indexed':false,'internalType':'uint256','name':'wad','type':'uint256'}],'name':'Approval','type':'event'},{'anonymous':true,'inputs':[{'indexed':true,'internalType':'bytes4','name':'sig','type':'bytes4'},{'indexed':true,'internalType':'address','name':'usr','type':'address'},{'indexed':true,'internalType':'bytes32','name':'arg1','type':'bytes32'},{'indexed':true,'internalType':'bytes32','name':'arg2','type':'bytes32'},{'indexed':false,'internalType':'bytes','name':'data','type':'bytes'}],'name':'LogNote','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'src','type':'address'},{'indexed':true,'internalType':'address','name':'dst','type':'address'},{'indexed':false,'internalType':'uint256','name':'wad','type':'uint256'}],'name':'Transfer','type':'event'},{'constant':true,'inputs':[],'name':'DOMAIN_SEPARATOR','outputs':[{'internalType':'bytes32','name':'','type':'bytes32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'PERMIT_TYPEHASH','outputs':[{'internalType':'bytes32','name':'','type':'bytes32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'}],'name':'allowance','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'usr','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'approve','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'balanceOf','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'usr','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'burn', 'outputs':[],'payable':false, 'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'decimals','outputs':[{'internalType':'uint8','name':'','type':'uint8'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'guy','type':'address'}],'name':'deny','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'usr','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'mint','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'src','type':'address'},{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'move','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'name','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'nonces','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'holder','type':'address'},{'internalType':'address','name':'spender','type':'address'},{'internalType':'uint256','name':'nonce','type':'uint256'},{'internalType':'uint256','name':'expiry','type':'uint256'},{'internalType':'bool','name':'allowed','type':'bool'},{'internalType':'uint8','name':'v','type':'uint8'},{'internalType':'bytes32','name':'r','type':'bytes32'},{'internalType':'bytes32','name':'s','type':'bytes32'}],'name':'permit','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'usr','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'pull','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'usr','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'push','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'guy','type':'address'}],'name':'rely','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'symbol','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'totalSupply','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'transfer','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'src','type':'address'},{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'wad','type':'uint256'}],'name':'transferFrom','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'version','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'wards','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'}];
const cTokenAbi = [{'inputs':[],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'cashPrior','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'interestAccumulated','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'borrowIndex','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'totalBorrows','type':'uint256'}],'name':'AccrueInterest','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'owner','type':'address'},{'indexed':true,'internalType':'address','name':'spender','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount','type':'uint256'}],'name':'Approval','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'borrower','type':'address'},{'indexed':false,'internalType':'uint256','name':'borrowAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'accountBorrows','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'totalBorrows','type':'uint256'}],'name':'Borrow','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'error','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'info','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'detail','type':'uint256'}],'name':'Failure','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'liquidator','type':'address'},{'indexed':false,'internalType':'address','name':'borrower','type':'address'},{'indexed':false,'internalType':'uint256','name':'repayAmount','type':'uint256'},{'indexed':false,'internalType':'address','name':'cTokenCollateral','type':'address'},{'indexed':false,'internalType':'uint256','name':'seizeTokens','type':'uint256'}],'name':'LiquidateBorrow','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'minter','type':'address'},{'indexed':false,'internalType':'uint256','name':'mintAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'mintTokens','type':'uint256'}],'name':'Mint','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'oldAdmin','type':'address'},{'indexed':false,'internalType':'address','name':'newAdmin','type':'address'}],'name':'NewAdmin','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract ComptrollerInterface','name':'oldComptroller','type':'address'},{'indexed':false,'internalType':'contract ComptrollerInterface','name':'newComptroller','type':'address'}],'name':'NewComptroller','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract InterestRateModel','name':'oldInterestRateModel','type':'address'},{'indexed':false,'internalType':'contract InterestRateModel','name':'newInterestRateModel','type':'address'}],'name':'NewMarketInterestRateModel','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'oldPendingAdmin','type':'address'},{'indexed':false,'internalType':'address','name':'newPendingAdmin','type':'address'}],'name':'NewPendingAdmin','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'oldReserveFactorMantissa','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newReserveFactorMantissa','type':'uint256'}],'name':'NewReserveFactor','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'redeemer','type':'address'},{'indexed':false,'internalType':'uint256','name':'redeemAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'redeemTokens','type':'uint256'}],'name':'Redeem','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'payer','type':'address'},{'indexed':false,'internalType':'address','name':'borrower','type':'address'},{'indexed':false,'internalType':'uint256','name':'repayAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'accountBorrows','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'totalBorrows','type':'uint256'}],'name':'RepayBorrow','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'benefactor','type':'address'},{'indexed':false,'internalType':'uint256','name':'addAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newTotalReserves','type':'uint256'}],'name':'ReservesAdded','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'admin','type':'address'},{'indexed':false,'internalType':'uint256','name':'reduceAmount','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newTotalReserves','type':'uint256'}],'name':'ReservesReduced','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'from','type':'address'},{'indexed':true,'internalType':'address','name':'to','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount','type':'uint256'}],'name':'Transfer','type':'event'},{'constant':false,'inputs':[],'name':'_acceptAdmin','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'addAmount','type':'uint256'}],'name':'_addReserves','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'bytes','name':'data','type':'bytes'}],'name':'_becomeImplementation','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'compLikeDelegatee','type':'address'}],'name':'_delegateCompLikeTo','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'reduceAmount','type':'uint256'}],'name':'_reduceReserves','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[],'name':'_resignImplementation','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract ComptrollerInterface','name':'newComptroller','type':'address'}],'name':'_setComptroller','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract InterestRateModel','name':'newInterestRateModel','type':'address'}],'name':'_setInterestRateModel','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address payable','name':'newPendingAdmin','type':'address'}],'name':'_setPendingAdmin','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'newReserveFactorMantissa','type':'uint256'}],'name':'_setReserveFactor','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'accrualBlockNumber','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[],'name':'accrueInterest','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'admin','outputs':[{'internalType':'address payable','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'owner','type':'address'},{'internalType':'address','name':'spender','type':'address'}],'name':'allowance','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'spender','type':'address'},{'internalType':'uint256','name':'amount','type':'uint256'}],'name':'approve','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'owner','type':'address'}],'name':'balanceOf','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'owner','type':'address'}],'name':'balanceOfUnderlying','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'borrowAmount','type':'uint256'}],'name':'borrow','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'account','type':'address'}],'name':'borrowBalanceCurrent','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'}],'name':'borrowBalanceStored','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'borrowIndex','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'borrowRatePerBlock','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'comptroller','outputs':[{'internalType':'contract ComptrollerInterface','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'decimals','outputs':[{'internalType':'uint8','name':'','type':'uint8'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[],'name':'exchangeRateCurrent','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'exchangeRateStored','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'}],'name':'getAccountSnapshot','outputs':[{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'getCash','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'implementation','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'underlying_','type':'address'},{'internalType':'contract ComptrollerInterface','name':'comptroller_','type':'address'},{'internalType':'contract InterestRateModel','name':'interestRateModel_','type':'address'},{'internalType':'uint256','name':'initialExchangeRateMantissa_','type':'uint256'},{'internalType':'string','name':'name_','type':'string'},{'internalType':'string','name':'symbol_','type':'string'},{'internalType':'uint8','name':'decimals_','type':'uint8'}],'name':'initialize','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract ComptrollerInterface','name':'comptroller_','type':'address'},{'internalType':'contract InterestRateModel','name':'interestRateModel_','type':'address'},{'internalType':'uint256','name':'initialExchangeRateMantissa_','type':'uint256'},{'internalType':'string','name':'name_','type':'string'},{'internalType':'string','name':'symbol_','type':'string'},{'internalType':'uint8','name':'decimals_','type':'uint8'}],'name':'initialize','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'interestRateModel','outputs':[{'internalType':'contract InterestRateModel','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'isCToken','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'repayAmount','type':'uint256'},{'internalType':'contract CTokenInterface','name':'cTokenCollateral','type':'address'}],'name':'liquidateBorrow','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'mintAmount','type':'uint256'}],'name':'mint','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'name','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'pendingAdmin','outputs':[{'internalType':'address payable','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'protocolSeizeShareMantissa','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'redeemTokens','type':'uint256'}],'name':'redeem','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'redeemAmount','type':'uint256'}],'name':'redeemUnderlying','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'repayAmount','type':'uint256'}],'name':'repayBorrow','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'repayAmount','type':'uint256'}],'name':'repayBorrowBehalf','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'reserveFactorMantissa','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'liquidator','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'seizeTokens','type':'uint256'}],'name':'seize','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'supplyRatePerBlock','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'contract EIP20NonStandardInterface','name':'token','type':'address'}],'name':'sweepToken','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'symbol','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'totalBorrows','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[],'name':'totalBorrowsCurrent','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'totalReserves','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'totalSupply','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'amount','type':'uint256'}],'name':'transfer','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'src','type':'address'},{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'amount','type':'uint256'}],'name':'transferFrom','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'underlying','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'}];
const comptrollerAbi = [{'inputs':[],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'string','name':'action','type':'string'},{'indexed':false,'internalType':'bool','name':'pauseState','type':'bool'}],'name':'ActionPaused','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'string','name':'action','type':'string'},{'indexed':false,'internalType':'bool','name':'pauseState','type':'bool'}],'name':'ActionPaused','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'uint256','name':'newSpeed','type':'uint256'}],'name':'CompBorrowSpeedUpdated','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'recipient','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount','type':'uint256'}],'name':'CompGranted','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'uint256','name':'newSpeed','type':'uint256'}],'name':'CompSupplySpeedUpdated','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'contributor','type':'address'},{'indexed':false,'internalType':'uint256','name':'newSpeed','type':'uint256'}],'name':'ContributorCompSpeedUpdated','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':true,'internalType':'address','name':'borrower','type':'address'},{'indexed':false,'internalType':'uint256','name':'compDelta','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'compBorrowIndex','type':'uint256'}],'name':'DistributedBorrowerComp','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':true,'internalType':'address','name':'supplier','type':'address'},{'indexed':false,'internalType':'uint256','name':'compDelta','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'compSupplyIndex','type':'uint256'}],'name':'DistributedSupplierComp','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'error','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'info','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'detail','type':'uint256'}],'name':'Failure','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'address','name':'account','type':'address'}],'name':'MarketEntered','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'address','name':'account','type':'address'}],'name':'MarketExited','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract CToken','name':'cToken','type':'address'}],'name':'MarketListed','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'uint256','name':'newBorrowCap','type':'uint256'}],'name':'NewBorrowCap','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'oldBorrowCapGuardian','type':'address'},{'indexed':false,'internalType':'address','name':'newBorrowCapGuardian','type':'address'}],'name':'NewBorrowCapGuardian','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'oldCloseFactorMantissa','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newCloseFactorMantissa','type':'uint256'}],'name':'NewCloseFactor','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract CToken','name':'cToken','type':'address'},{'indexed':false,'internalType':'uint256','name':'oldCollateralFactorMantissa','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newCollateralFactorMantissa','type':'uint256'}],'name':'NewCollateralFactor','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint256','name':'oldLiquidationIncentiveMantissa','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'newLiquidationIncentiveMantissa','type':'uint256'}],'name':'NewLiquidationIncentive','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'oldPauseGuardian','type':'address'},{'indexed':false,'internalType':'address','name':'newPauseGuardian','type':'address'}],'name':'NewPauseGuardian','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'contract PriceOracle','name':'oldPriceOracle','type':'address'},{'indexed':false,'internalType':'contract PriceOracle','name':'newPriceOracle','type':'address'}],'name':'NewPriceOracle','type':'event'},{'constant':false,'inputs':[{'internalType':'contract Unitroller','name':'unitroller','type':'address'}],'name':'_become','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'_borrowGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'uint256','name':'amount','type':'uint256'}],'name':'_grantComp','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'_mintGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'newBorrowCapGuardian','type':'address'}],'name':'_setBorrowCapGuardian','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken','name':'cToken','type':'address'},{'internalType':'bool','name':'state','type':'bool'}],'name':'_setBorrowPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'newCloseFactorMantissa','type':'uint256'}],'name':'_setCloseFactor','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken','name':'cToken','type':'address'},{'internalType':'uint256','name':'newCollateralFactorMantissa','type':'uint256'}],'name':'_setCollateralFactor','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken[]','name':'cTokens','type':'address[]'},{'internalType':'uint256[]','name':'supplySpeeds','type':'uint256[]'},{'internalType':'uint256[]','name':'borrowSpeeds','type':'uint256[]'}],'name':'_setCompSpeeds','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'contributor','type':'address'},{'internalType':'uint256','name':'compSpeed','type':'uint256'}],'name':'_setContributorCompSpeed','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'newLiquidationIncentiveMantissa','type':'uint256'}],'name':'_setLiquidationIncentive','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken[]','name':'cTokens','type':'address[]'},{'internalType':'uint256[]','name':'newBorrowCaps','type':'uint256[]'}],'name':'_setMarketBorrowCaps','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken','name':'cToken','type':'address'},{'internalType':'bool','name':'state','type':'bool'}],'name':'_setMintPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'newPauseGuardian','type':'address'}],'name':'_setPauseGuardian','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract PriceOracle','name':'newOracle','type':'address'}],'name':'_setPriceOracle','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'bool','name':'state','type':'bool'}],'name':'_setSeizePaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'bool','name':'state','type':'bool'}],'name':'_setTransferPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'contract CToken','name':'cToken','type':'address'}],'name':'_supportMarket','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'uint256','name':'','type':'uint256'}],'name':'accountAssets','outputs':[{'internalType':'contract CToken','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'admin','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'uint256','name':'','type':'uint256'}],'name':'allMarkets','outputs':[{'internalType':'contract CToken','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'borrowAmount','type':'uint256'}],'name':'borrowAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'borrowCapGuardian','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'borrowCaps','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'borrowGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'borrowAmount','type':'uint256'}],'name':'borrowVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'},{'internalType':'contract CToken','name':'cToken','type':'address'}],'name':'checkMembership','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'holder','type':'address'},{'internalType':'contract CToken[]','name':'cTokens','type':'address[]'}],'name':'claimComp','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address[]','name':'holders','type':'address[]'},{'internalType':'contract CToken[]','name':'cTokens','type':'address[]'},{'internalType':'bool','name':'borrowers','type':'bool'},{'internalType':'bool','name':'suppliers','type':'bool'}],'name':'claimComp','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'holder','type':'address'}],'name':'claimComp','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'closeFactorMantissa','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compAccrued','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compBorrowSpeeds','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compBorrowState','outputs':[{'internalType':'uint224','name':'index','type':'uint224'},{'internalType':'uint32','name':'block','type':'uint32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'}],'name':'compBorrowerIndex','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compContributorSpeeds','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'compInitialIndex','outputs':[{'internalType':'uint224','name':'','type':'uint224'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'compRate','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compSpeeds','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'}],'name':'compSupplierIndex','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compSupplySpeeds','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'compSupplyState','outputs':[{'internalType':'uint224','name':'index','type':'uint224'},{'internalType':'uint32','name':'block','type':'uint32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'comptrollerImplementation','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address[]','name':'cTokens','type':'address[]'}],'name':'enterMarkets','outputs':[{'internalType':'uint256[]','name':'','type':'uint256[]'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cTokenAddress','type':'address'}],'name':'exitMarket','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'}],'name':'getAccountLiquidity','outputs':[{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'getAllMarkets','outputs':[{'internalType':'contract CToken[]','name':'','type':'address[]'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'}],'name':'getAssetsIn','outputs':[{'internalType':'contract CToken[]','name':'','type':'address[]'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'getBlockNumber','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'getCompAddress','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'account','type':'address'},{'internalType':'address','name':'cTokenModify','type':'address'},{'internalType':'uint256','name':'redeemTokens','type':'uint256'},{'internalType':'uint256','name':'borrowAmount','type':'uint256'}],'name':'getHypotheticalAccountLiquidity','outputs':[{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'isComptroller','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'contract CToken','name':'cToken','type':'address'}],'name':'isDeprecated','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'lastContributorBlock','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cTokenBorrowed','type':'address'},{'internalType':'address','name':'cTokenCollateral','type':'address'},{'internalType':'address','name':'liquidator','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'repayAmount','type':'uint256'}],'name':'liquidateBorrowAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cTokenBorrowed','type':'address'},{'internalType':'address','name':'cTokenCollateral','type':'address'},{'internalType':'address','name':'liquidator','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'actualRepayAmount','type':'uint256'},{'internalType':'uint256','name':'seizeTokens','type':'uint256'}],'name':'liquidateBorrowVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'cTokenBorrowed','type':'address'},{'internalType':'address','name':'cTokenCollateral','type':'address'},{'internalType':'uint256','name':'actualRepayAmount','type':'uint256'}],'name':'liquidateCalculateSeizeTokens','outputs':[{'internalType':'uint256','name':'','type':'uint256'},{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'liquidationIncentiveMantissa','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'markets','outputs':[{'internalType':'bool','name':'isListed','type':'bool'},{'internalType':'uint256','name':'collateralFactorMantissa','type':'uint256'},{'internalType':'bool','name':'isComped','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'maxAssets','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'minter','type':'address'},{'internalType':'uint256','name':'mintAmount','type':'uint256'}],'name':'mintAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'mintGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'minter','type':'address'},{'internalType':'uint256','name':'actualMintAmount','type':'uint256'},{'internalType':'uint256','name':'mintTokens','type':'uint256'}],'name':'mintVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'oracle','outputs':[{'internalType':'contract PriceOracle','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'pauseGuardian','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'pendingAdmin','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'pendingComptrollerImplementation','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'redeemer','type':'address'},{'internalType':'uint256','name':'redeemTokens','type':'uint256'}],'name':'redeemAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'redeemer','type':'address'},{'internalType':'uint256','name':'redeemAmount','type':'uint256'},{'internalType':'uint256','name':'redeemTokens','type':'uint256'}],'name':'redeemVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'payer','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'repayAmount','type':'uint256'}],'name':'repayBorrowAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'payer','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'actualRepayAmount','type':'uint256'},{'internalType':'uint256','name':'borrowerIndex','type':'uint256'}],'name':'repayBorrowVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cTokenCollateral','type':'address'},{'internalType':'address','name':'cTokenBorrowed','type':'address'},{'internalType':'address','name':'liquidator','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'seizeTokens','type':'uint256'}],'name':'seizeAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'seizeGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cTokenCollateral','type':'address'},{'internalType':'address','name':'cTokenBorrowed','type':'address'},{'internalType':'address','name':'liquidator','type':'address'},{'internalType':'address','name':'borrower','type':'address'},{'internalType':'uint256','name':'seizeTokens','type':'uint256'}],'name':'seizeVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'src','type':'address'},{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'transferTokens','type':'uint256'}],'name':'transferAllowed','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'transferGuardianPaused','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'cToken','type':'address'},{'internalType':'address','name':'src','type':'address'},{'internalType':'address','name':'dst','type':'address'},{'internalType':'uint256','name':'transferTokens','type':'uint256'}],'name':'transferVerify','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'contributor','type':'address'}],'name':'updateContributorRewards','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'}];
const uniswapV2FactoryABI = [{'inputs':[{'internalType':'address','name':'_feeToSetter','type':'address'}],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'token0','type':'address'},{'indexed':true,'internalType':'address','name':'token1','type':'address'},{'indexed':false,'internalType':'address','name':'pair','type':'address'},{'indexed':false,'internalType':'uint256','name':'','type':'uint256'}],'name':'PairCreated','type':'event'},{'constant':true,'inputs':[{'internalType':'uint256','name':'','type':'uint256'}],'name':'allPairs','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'allPairsLength','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'tokenA','type':'address'},{'internalType':'address','name':'tokenB','type':'address'}],'name':'createPair','outputs':[{'internalType':'address','name':'pair','type':'address'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'feeTo','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'feeToSetter','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'}],'name':'getPair','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'_feeTo','type':'address'}],'name':'setFeeTo','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'_feeToSetter','type':'address'}],'name':'setFeeToSetter','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'}];
const uniswapV2PairABI = [{'inputs':[],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'owner','type':'address'},{'indexed':true,'internalType':'address','name':'spender','type':'address'},{'indexed':false,'internalType':'uint256','name':'value','type':'uint256'}],'name':'Approval','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1','type':'uint256'},{'indexed':true,'internalType':'address','name':'to','type':'address'}],'name':'Burn','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1','type':'uint256'}],'name':'Mint','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount0In','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1In','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount0Out','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1Out','type':'uint256'},{'indexed':true,'internalType':'address','name':'to','type':'address'}],'name':'Swap','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint112','name':'reserve0','type':'uint112'},{'indexed':false,'internalType':'uint112','name':'reserve1','type':'uint112'}],'name':'Sync','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'from','type':'address'},{'indexed':true,'internalType':'address','name':'to','type':'address'},{'indexed':false,'internalType':'uint256','name':'value','type':'uint256'}],'name':'Transfer','type':'event'},{'constant':true,'inputs':[],'name':'DOMAIN_SEPARATOR','outputs':[{'internalType':'bytes32','name':'','type':'bytes32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'MINIMUM_LIQUIDITY','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'PERMIT_TYPEHASH','outputs':[{'internalType':'bytes32','name':'','type':'bytes32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'}],'name':'allowance','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'spender','type':'address'},{'internalType':'uint256','name':'value','type':'uint256'}],'name':'approve','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'balanceOf','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'to','type':'address'}],'name':'burn','outputs':[{'internalType':'uint256','name':'amount0','type':'uint256'},{'internalType':'uint256','name':'amount1','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'decimals','outputs':[{'internalType':'uint8','name':'','type':'uint8'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'factory','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'getReserves','outputs':[{'internalType':'uint112','name':'_reserve0','type':'uint112'},{'internalType':'uint112','name':'_reserve1','type':'uint112'},{'internalType':'uint32','name':'_blockTimestampLast','type':'uint32'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'_token0','type':'address'},{'internalType':'address','name':'_token1','type':'address'}],'name':'initialize','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'kLast','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'to','type':'address'}],'name':'mint','outputs':[{'internalType':'uint256','name':'liquidity','type':'uint256'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'name','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'internalType':'address','name':'','type':'address'}],'name':'nonces','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'owner','type':'address'},{'internalType':'address','name':'spender','type':'address'},{'internalType':'uint256','name':'value','type':'uint256'},{'internalType':'uint256','name':'deadline','type':'uint256'},{'internalType':'uint8','name':'v','type':'uint8'},{'internalType':'bytes32','name':'r','type':'bytes32'},{'internalType':'bytes32','name':'s','type':'bytes32'}],'name':'permit','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'price0CumulativeLast','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'price1CumulativeLast','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'to','type':'address'}],'name':'skim','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'uint256','name':'amount0Out','type':'uint256'},{'internalType':'uint256','name':'amount1Out','type':'uint256'},{'internalType':'address','name':'to','type':'address'},{'internalType':'bytes','name':'data','type':'bytes'}],'name':'swap','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'symbol','outputs':[{'internalType':'string','name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[],'name':'sync','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'token0','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'token1','outputs':[{'internalType':'address','name':'','type':'address'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'totalSupply','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'to','type':'address'},{'internalType':'uint256','name':'value','type':'uint256'}],'name':'transfer','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':false,'inputs':[{'internalType':'address','name':'from','type':'address'},{'internalType':'address','name':'to','type':'address'},{'internalType':'uint256','name':'value','type':'uint256'}],'name':'transferFrom','outputs':[{'internalType':'bool','name':'','type':'bool'}],'payable':false,'stateMutability':'nonpayable','type':'function'}];
const uniswapFactoryV3Abi = [{'inputs':[],'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'uint24','name':'fee','type':'uint24'},{'indexed':true,'internalType':'int24','name':'tickSpacing','type':'int24'}],'name':'FeeAmountEnabled','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'oldOwner','type':'address'},{'indexed':true,'internalType':'address','name':'newOwner','type':'address'}],'name':'OwnerChanged','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'token0','type':'address'},{'indexed':true,'internalType':'address','name':'token1','type':'address'},{'indexed':true,'internalType':'uint24','name':'fee','type':'uint24'},{'indexed':false,'internalType':'int24','name':'tickSpacing','type':'int24'},{'indexed':false,'internalType':'address','name':'pool','type':'address'}],'name':'PoolCreated','type':'event'},{'inputs':[{'internalType':'address','name':'tokenA','type':'address'},{'internalType':'address','name':'tokenB','type':'address'},{'internalType':'uint24','name':'fee','type':'uint24'}],'name':'createPool','outputs':[{'internalType':'address','name':'pool','type':'address'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'uint24','name':'fee','type':'uint24'},{'internalType':'int24','name':'tickSpacing','type':'int24'}],'name':'enableFeeAmount','outputs':[],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'uint24','name':'','type':'uint24'}],'name':'feeAmountTickSpacing','outputs':[{'internalType':'int24','name':'','type':'int24'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'address','name':'','type':'address'},{'internalType':'address','name':'','type':'address'},{'internalType':'uint24','name':'','type':'uint24'}],'name':'getPool','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'owner','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'parameters','outputs':[{'internalType':'address','name':'factory','type':'address'},{'internalType':'address','name':'token0','type':'address'},{'internalType':'address','name':'token1','type':'address'},{'internalType':'uint24','name':'fee','type':'uint24'},{'internalType':'int24','name':'tickSpacing','type':'int24'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'address','name':'_owner','type':'address'}],'name':'setOwner','outputs':[],'stateMutability':'nonpayable','type':'function'}];
const uniswapV3PairAbi = [{'inputs':[],'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'owner','type':'address'},{'indexed':true,'internalType':'int24','name':'tickLower','type':'int24'},{'indexed':true,'internalType':'int24','name':'tickUpper','type':'int24'},{'indexed':false,'internalType':'uint128','name':'amount','type':'uint128'},{'indexed':false,'internalType':'uint256','name':'amount0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1','type':'uint256'}],'name':'Burn','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'owner','type':'address'},{'indexed':false,'internalType':'address','name':'recipient','type':'address'},{'indexed':true,'internalType':'int24','name':'tickLower','type':'int24'},{'indexed':true,'internalType':'int24','name':'tickUpper','type':'int24'},{'indexed':false,'internalType':'uint128','name':'amount0','type':'uint128'},{'indexed':false,'internalType':'uint128','name':'amount1','type':'uint128'}],'name':'Collect','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':true,'internalType':'address','name':'recipient','type':'address'},{'indexed':false,'internalType':'uint128','name':'amount0','type':'uint128'},{'indexed':false,'internalType':'uint128','name':'amount1','type':'uint128'}],'name':'CollectProtocol','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':true,'internalType':'address','name':'recipient','type':'address'},{'indexed':false,'internalType':'uint256','name':'amount0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'paid0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'paid1','type':'uint256'}],'name':'Flash','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint16','name':'observationCardinalityNextOld','type':'uint16'},{'indexed':false,'internalType':'uint16','name':'observationCardinalityNextNew','type':'uint16'}],'name':'IncreaseObservationCardinalityNext','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint160','name':'sqrtPriceX96','type':'uint160'},{'indexed':false,'internalType':'int24','name':'tick','type':'int24'}],'name':'Initialize','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'address','name':'sender','type':'address'},{'indexed':true,'internalType':'address','name':'owner','type':'address'},{'indexed':true,'internalType':'int24','name':'tickLower','type':'int24'},{'indexed':true,'internalType':'int24','name':'tickUpper','type':'int24'},{'indexed':false,'internalType':'uint128','name':'amount','type':'uint128'},{'indexed':false,'internalType':'uint256','name':'amount0','type':'uint256'},{'indexed':false,'internalType':'uint256','name':'amount1','type':'uint256'}],'name':'Mint','type':'event'},{'anonymous':false,'inputs':[{'indexed':false,'internalType':'uint8','name':'feeProtocol0Old','type':'uint8'},{'indexed':false,'internalType':'uint8','name':'feeProtocol1Old','type':'uint8'},{'indexed':false,'internalType':'uint8','name':'feeProtocol0New','type':'uint8'},{'indexed':false,'internalType':'uint8','name':'feeProtocol1New','type':'uint8'}],'name':'SetFeeProtocol','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'internalType':'address','name':'sender','type':'address'},{'indexed':true,'internalType':'address','name':'recipient','type':'address'},{'indexed':false,'internalType':'int256','name':'amount0','type':'int256'},{'indexed':false,'internalType':'int256','name':'amount1','type':'int256'},{'indexed':false,'internalType':'uint160','name':'sqrtPriceX96','type':'uint160'},{'indexed':false,'internalType':'uint128','name':'liquidity','type':'uint128'},{'indexed':false,'internalType':'int24','name':'tick','type':'int24'}],'name':'Swap','type':'event'},{'inputs':[{'internalType':'int24','name':'tickLower','type':'int24'},{'internalType':'int24','name':'tickUpper','type':'int24'},{'internalType':'uint128','name':'amount','type':'uint128'}],'name':'burn','outputs':[{'internalType':'uint256','name':'amount0','type':'uint256'},{'internalType':'uint256','name':'amount1','type':'uint256'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'int24','name':'tickLower','type':'int24'},{'internalType':'int24','name':'tickUpper','type':'int24'},{'internalType':'uint128','name':'amount0Requested','type':'uint128'},{'internalType':'uint128','name':'amount1Requested','type':'uint128'}],'name':'collect','outputs':[{'internalType':'uint128','name':'amount0','type':'uint128'},{'internalType':'uint128','name':'amount1','type':'uint128'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'uint128','name':'amount0Requested','type':'uint128'},{'internalType':'uint128','name':'amount1Requested','type':'uint128'}],'name':'collectProtocol','outputs':[{'internalType':'uint128','name':'amount0','type':'uint128'},{'internalType':'uint128','name':'amount1','type':'uint128'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[],'name':'factory','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'fee','outputs':[{'internalType':'uint24','name':'','type':'uint24'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'feeGrowthGlobal0X128','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'feeGrowthGlobal1X128','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'uint256','name':'amount0','type':'uint256'},{'internalType':'uint256','name':'amount1','type':'uint256'},{'internalType':'bytes','name':'data','type':'bytes'}],'name':'flash','outputs':[],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'uint16','name':'observationCardinalityNext','type':'uint16'}],'name':'increaseObservationCardinalityNext','outputs':[],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'uint160','name':'sqrtPriceX96','type':'uint160'}],'name':'initialize','outputs':[],'stateMutability':'nonpayable','type':'function'},{'inputs':[],'name':'liquidity','outputs':[{'internalType':'uint128','name':'','type':'uint128'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'maxLiquidityPerTick','outputs':[{'internalType':'uint128','name':'','type':'uint128'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'int24','name':'tickLower','type':'int24'},{'internalType':'int24','name':'tickUpper','type':'int24'},{'internalType':'uint128','name':'amount','type':'uint128'},{'internalType':'bytes','name':'data','type':'bytes'}],'name':'mint','outputs':[{'internalType':'uint256','name':'amount0','type':'uint256'},{'internalType':'uint256','name':'amount1','type':'uint256'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'uint256','name':'','type':'uint256'}],'name':'observations','outputs':[{'internalType':'uint32','name':'blockTimestamp','type':'uint32'},{'internalType':'int56','name':'tickCumulative','type':'int56'},{'internalType':'uint160','name':'secondsPerLiquidityCumulativeX128','type':'uint160'},{'internalType':'bool','name':'initialized','type':'bool'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'uint32[]','name':'secondsAgos','type':'uint32[]'}],'name':'observe','outputs':[{'internalType':'int56[]','name':'tickCumulatives','type':'int56[]'},{'internalType':'uint160[]','name':'secondsPerLiquidityCumulativeX128s','type':'uint160[]'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'bytes32','name':'','type':'bytes32'}],'name':'positions','outputs':[{'internalType':'uint128','name':'liquidity','type':'uint128'},{'internalType':'uint256','name':'feeGrowthInside0LastX128','type':'uint256'},{'internalType':'uint256','name':'feeGrowthInside1LastX128','type':'uint256'},{'internalType':'uint128','name':'tokensOwed0','type':'uint128'},{'internalType':'uint128','name':'tokensOwed1','type':'uint128'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'protocolFees','outputs':[{'internalType':'uint128','name':'token0','type':'uint128'},{'internalType':'uint128','name':'token1','type':'uint128'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'uint8','name':'feeProtocol0','type':'uint8'},{'internalType':'uint8','name':'feeProtocol1','type':'uint8'}],'name':'setFeeProtocol','outputs':[],'stateMutability':'nonpayable','type':'function'},{'inputs':[],'name':'slot0','outputs':[{'internalType':'uint160','name':'sqrtPriceX96','type':'uint160'},{'internalType':'int24','name':'tick','type':'int24'},{'internalType':'uint16','name':'observationIndex','type':'uint16'},{'internalType':'uint16','name':'observationCardinality','type':'uint16'},{'internalType':'uint16','name':'observationCardinalityNext','type':'uint16'},{'internalType':'uint8','name':'feeProtocol','type':'uint8'},{'internalType':'bool','name':'unlocked','type':'bool'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'int24','name':'tickLower','type':'int24'},{'internalType':'int24','name':'tickUpper','type':'int24'}],'name':'snapshotCumulativesInside','outputs':[{'internalType':'int56','name':'tickCumulativeInside','type':'int56'},{'internalType':'uint160','name':'secondsPerLiquidityInsideX128','type':'uint160'},{'internalType':'uint32','name':'secondsInside','type':'uint32'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'address','name':'recipient','type':'address'},{'internalType':'bool','name':'zeroForOne','type':'bool'},{'internalType':'int256','name':'amountSpecified','type':'int256'},{'internalType':'uint160','name':'sqrtPriceLimitX96','type':'uint160'},{'internalType':'bytes','name':'data','type':'bytes'}],'name':'swap','outputs':[{'internalType':'int256','name':'amount0','type':'int256'},{'internalType':'int256','name':'amount1','type':'int256'}],'stateMutability':'nonpayable','type':'function'},{'inputs':[{'internalType':'int16','name':'','type':'int16'}],'name':'tickBitmap','outputs':[{'internalType':'uint256','name':'','type':'uint256'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'tickSpacing','outputs':[{'internalType':'int24','name':'','type':'int24'}],'stateMutability':'view','type':'function'},{'inputs':[{'internalType':'int24','name':'','type':'int24'}],'name':'ticks','outputs':[{'internalType':'uint128','name':'liquidityGross','type':'uint128'},{'internalType':'int128','name':'liquidityNet','type':'int128'},{'internalType':'uint256','name':'feeGrowthOutside0X128','type':'uint256'},{'internalType':'uint256','name':'feeGrowthOutside1X128','type':'uint256'},{'internalType':'int56','name':'tickCumulativeOutside','type':'int56'},{'internalType':'uint160','name':'secondsPerLiquidityOutsideX128','type':'uint160'},{'internalType':'uint32','name':'secondsOutside','type':'uint32'},{'internalType':'bool','name':'initialized','type':'bool'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'token0','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'},{'inputs':[],'name':'token1','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'}];

const comptrollerAddress = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const cEthAddress = '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5';
const cSaiAddress = '0xF5DCe57282A584D2746FaF1593d3121Fcac444dC';
const cRepAddress = '0x158079Ee67Fce2f58472A96584A73C7Ab9AC95c1';
const marketToIgnore = [cEthAddress, cSaiAddress, cRepAddress];
const cmkrAddress = '0x95b4eF2869eBD94BEb4eEE400a99824BF5DC325b';

const compoundMarkets = ['BAT','DAI','USDC','USDT','WBTC','ZRX','UNI','COMP','TUSD','LINK','MKR','SUSHI','AAVE','YFI','USDP','FEI','WETH'];
const quotes = ['WETH', 'USDC', 'DAI', 'WBTC'];
const uniswapV2Pairs = ['BAT-WETH','BAT-USDC','BAT-DAI','BAT-WBTC','DAI-WETH','DAI-USDC','WBTC-DAI','USDC-WETH','WBTC-USDC','WETH-USDT','USDC-USDT','DAI-USDT','WBTC-USDT','WBTC-WETH','WETH-ZRX','USDC-ZRX','DAI-ZRX','UNI-WETH','UNI-USDC','UNI-DAI','UNI-WBTC','COMP-WETH','USDC-COMP','DAI-COMP','TUSD-WETH','TUSD-USDC','TUSD-DAI','TUSD-WBTC','LINK-WETH','LINK-USDC','LINK-DAI','WBTC-LINK','MKR-WETH','MKR-USDC','DAI-MKR','SUSHI-WETH','SUSHI-USDC','AAVE-WETH','AAVE-USDC','DAI-AAVE','WBTC-AAVE','YFI-WETH','YFI-USDC','YFI-DAI','YFI-WBTC','USDP-WETH','USDP-USDC','DAI-USDP','FEI-WETH','FEI-USDC','DAI-FEI'];


async function getUnivV2Pools() {
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const factoryContract = new ethers.Contract('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', uniswapV2FactoryABI, web3Provider);

    for(const market of compoundMarkets) {
        const baseToken = tokens[market];
        if(!baseToken) {
            console.log(`${market} not found in conf`);
        }
    }

    const univ2Conf = [];
    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            const baseToken = tokens[market];
            if(!baseToken) {
                throw new Error(`${market} not found in conf`);
            }
            const quoteToken = tokens[quote];

            const pairAddress = await factoryContract.getPair(baseToken.address, quoteToken.address);
            
            if(pairAddress == ethers.constants.AddressZero) {
                console.log(`No pool found for ${market}/${quote}`);
                continue;
            }
            const pairContract = new ethers.Contract(pairAddress, uniswapV2PairABI, web3Provider);
            const contractToken0 = await pairContract.token0();
            let confKey = `${market}-${quote}`;
            if(contractToken0.toLowerCase() != baseToken.address.toLowerCase()) {
                confKey = `${quote}-${market}`;
            }

            if(!univ2Conf.includes(confKey)) {
                univ2Conf.push(confKey);
            } else {
                console.log(`conf already has ${confKey}`);
            }
        }
    }
    fs.writeFileSync('compound_univ2_conf.json', JSON.stringify(univ2Conf, null, 2));
}


async function getUnivV3Pools() {
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const univ3Factory = new ethers.Contract('0x1F98431c8aD98523631AE4a59f267346ea31F984', uniswapFactoryV3Abi, web3Provider);
    const fees = [10000,3000,500,100];

    const conf = [];
    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            const baseToken = getConfTokenBySymbol(market);
            const quoteToken =  getConfTokenBySymbol(quote);
            for(const fee of fees) {

                const poolAddress = await univ3Factory.getPool(baseToken.address, quoteToken.address, fee);
                
                if(poolAddress == ethers.constants.AddressZero) {
                    console.log(`No pool found for ${market}/${quote} and fee: ${fee}`);
                    continue;
                } else {
                    console.log(`Found a pool for ${market}/${quote} and fee: ${fee}`);

                }

                const univ3PairContract = new ethers.Contract(poolAddress, uniswapV3PairAbi, web3Provider);
                const contractToken0 = await univ3PairContract.token0();

                let reverse = false;
                if(contractToken0.toLowerCase() != baseToken.address.toLowerCase()) {
                    reverse = true;
                }

                if(reverse) {
                    conf.push({
                        token0: quoteToken.symbol,
                        token1: baseToken.symbol,
                        fees: fee
                    });
                } else {
                    
                    conf.push({
                        token0: baseToken.symbol,
                        token1: quoteToken.symbol,
                        fees: fee
                    });
                }
            }
        }
    }

    fs.writeFileSync('compound_univ3_conf.json', JSON.stringify(conf, null, 2));
}

async function getCurvePools() {
    let poolData = [];

    const urlToCall = [
        'https://api.curve.fi/api/getPools/ethereum/crypto',
        'https://api.curve.fi/api/getPools/ethereum/main',
        'https://api.curve.fi/api/getPools/ethereum/factory-crypto',
        'https://api.curve.fi/api/getPools/ethereum/factory'
    ];

    for(const url of urlToCall) {
        const resp = await axios.get(url);
        if(resp.data.success) {
            console.log(`got ${resp.data.data.poolData.length} pools from ${url}`);

            poolData = poolData.concat(resp.data.data.poolData);
            console.log(`New pool data count: ${poolData.length}`);
        } else {
            throw new Error(resp);
        }
    }

    const poolsToFetch = [];
    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            const baseToken = getConfTokenBySymbol(market);
            const quoteToken =  getConfTokenBySymbol(quote);

            if(market == quote) {
                console.log(`ignoring ${market}/${quote}`);
                continue;
            }


            const poolWithTokens = poolData.filter(_ => _.coinsAddresses.some(c => c.toLowerCase() == baseToken.address.toLowerCase()) 
                                                    && _.coinsAddresses.some(c => c.toLowerCase() == quoteToken.address.toLowerCase()));
            console.log(`Found ${poolWithTokens.length} pools for tokens ${baseToken.symbol}/${quoteToken.symbol}`);

            for(const pool of poolWithTokens) {
                if(pool.usdTotal <= 10000) {
                    console.log(`ignoring ${pool.name} because usdtotal= ${pool.usdTotal}`);
                    continue;
                }
                if(poolsToFetch.find(_ => _.address == pool.address)) {
                    console.log(`pool ${pool.name} is already added`);
                } else {
                    console.log(`Adding ${pool.name} to the list of pools to fetch`);
                    poolsToFetch.push(pool);
                }
            }
        }
    }

    console.log(`Found ${poolsToFetch.length} pools to fetch`);

    fs.writeFileSync('compound_curve_conf.json', JSON.stringify(poolsToFetch, null, 2));

}

function generateTargetCsvForUniv2() {
    const destDir = './nocommit/compound/uniswapv2';
            
    if(!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, {recursive: true});
    }

    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            if(market == quote) {
                console.log(`Ignore ${market}/${quote}`);
                continue;
            }

            console.log(`Working on ${market}/${quote}`);

            const baseToken = getConfTokenBySymbol(market);
            const quoteToken = getConfTokenBySymbol(quote);


            const fileInfo = getUniV2DataFile('./data', market, quote);
            if(!fileInfo) {
                console.log(`no data file for ${market}/${quote}`);
                continue;
            }
            
            const destFilename = path.join(destDir, `${baseToken.symbol}-${quoteToken.symbol}_uniswapv2.csv`);
            if(fs.existsSync(destFilename)) {
                console.log(destFilename + ' already exists, skipping generation');
                continue;
            }
            const fileContent = fs.readFileSync(fileInfo.path, 'utf-8').split('\n');
            
            const toWrite = [];
            for(let i = 1; i < fileContent.length -1; i++) {
                const splt = fileContent[i].split(',');
                const block = Number(splt[0]);
                const reserveFrom = fileInfo.reverse ? normalize(splt[2], baseToken.decimals) : normalize(splt[1], baseToken.decimals);
                const reserveTo = fileInfo.reverse ? normalize(splt[1], quoteToken.decimals): normalize(splt[2], quoteToken.decimals);

                const price = computeUniswapV2Price(reserveFrom, reserveTo);
                const liquidity5Pct = computeLiquidityUniV2Pool(reserveFrom, reserveTo, 5/100);

                toWrite.push(`${block},${reserveFrom},${reserveTo},${price},${liquidity5Pct}\n`);
            }

            fs.writeFileSync(destFilename, `block,reserve ${baseToken.symbol},reserve ${quoteToken.symbol},price,volume for slippage 5%\n`);
            fs.appendFileSync(destFilename, toWrite.join(''));
        }   
    }
}
function generateTargetCsvForCurve() {
    const destDir = './nocommit/compound/curve';
            
    if(!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, {recursive: true});
    }

    const curveSummary = JSON.parse(fs.readFileSync('./data/curve/curve_pools_summary.json'));
    const allCurveFiles = fs.readdirSync('./data/curve/').filter(_ => _.endsWith('.csv'));

    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            if(market == quote) {
                console.log(`Ignore ${market}/${quote}`);
                continue;
            }

            console.log(`Working on ${market}/${quote}`);

            const baseToken = getConfTokenBySymbol(market);
            const quoteToken = getConfTokenBySymbol(quote);


            for(const [poolName, poolComposition] of Object.entries(curveSummary)) {
                console.log(`working on ${poolName}`);
                if(!poolComposition[market]) {
                    console.log(`Could not find ${market} in ${poolName}`);
                    continue;
                }

                if(!poolComposition[quote]) {
                    console.log(`Could not find ${quote} in ${poolName}`);
                    continue;
                }

                const selectedFile = allCurveFiles.find(_ => _.startsWith(poolName));
                if(!selectedFile) {
                    throw new Error(`could not find pool file ${poolName}???`);
                }

                console.log(`selected file: ${selectedFile}`);
                const destFilename = path.join(destDir, `${baseToken.symbol}-${quoteToken.symbol}_${poolName}_curve.csv`);
                if(fs.existsSync(destFilename)) {
                    console.log(`${destFilename} already exists, skipping`);
                    continue;
                }
                const fileContent = fs.readFileSync(`./data/curve/${selectedFile}`, 'utf-8').split('\n');
                
                let toWrite = [];
                const headers = fileContent[0].split(',');
                let baseIndex = -1;
                let quoteIndex = -1;
                const orderedTokens = [];
                for(let i = 3; i < headers.length; i++) {
                    const tokenHeader = headers[i];
                    const tokenSymbol = tokenHeader.split('_')[1];
                    orderedTokens.push(getConfTokenBySymbol(tokenSymbol));
                    if(tokenSymbol == baseToken.symbol) {
                        baseIndex = i - 3;
                    }
                    if(tokenSymbol == quoteToken.symbol) {
                        quoteIndex = i -3;
                    }
                }
                fs.writeFileSync(destFilename, `block,reserve ${baseToken.symbol},reserve ${quoteToken.symbol},price,volume for slippage 5%\n`);


                for(let i = 1; i < fileContent.length -1; i = i + 10) {
                    const splt = fileContent[i].split(',');
                    const block = Number(splt[0]);
                    const ampFactor = Number(splt[1]);
                    const lpSupply = Number(splt[2]);
                    const tokenSuppliesBigInt18Decimals = [];
                    for(let i = 3; i < splt.length; i++) {
                        const tokenReserve = splt[i];
                        const matchToken = orderedTokens[i-3];
                        const tokenReserve18DecimalStr = tokenReserve + ''.padEnd(18 - matchToken.decimals, '0');
                        tokenSuppliesBigInt18Decimals.push(BigInt(tokenReserve18DecimalStr));
                    }

                    const baseAmount = (BigInt(10) ** BigInt(18));
                    const price = normalize(get_return(baseIndex, quoteIndex, baseAmount, tokenSuppliesBigInt18Decimals, ampFactor).toString(), 18);

                    const targetPrice = price - (price * 5/100);
                    const liquidity5Pct = normalize(computeLiquidityForSlippageCurvePool(baseToken.symbol, quoteToken.symbol, baseAmount, targetPrice, tokenSuppliesBigInt18Decimals, baseIndex, quoteIndex, ampFactor).toString(), 18);
    
                    const normalizedBaseReserve = normalize(tokenSuppliesBigInt18Decimals[baseIndex].toString(), 18);
                    const normalizedQuoteReserve = normalize(tokenSuppliesBigInt18Decimals[quoteIndex].toString(), 18);
                    toWrite.push(`${block},${normalizedBaseReserve},${normalizedQuoteReserve},${price},${liquidity5Pct}\n`);

                    if(toWrite.length > 500) {
                        fs.appendFileSync(destFilename, toWrite.join(''));
                        toWrite = [];
                    }
                }

                fs.appendFileSync(destFilename, toWrite.join(''));

            }

        }   
    }
}

function generateTargetCsvForUniv3() {
    const destDir = './nocommit/compound/uniswapv3';
            
    if(!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, {recursive: true});
    }

    const allUniv3Files = fs.readdirSync('./data/uniswapv3/').filter(_ => _.endsWith('.csv'));

    for(const market of compoundMarkets) {
        for(const quote of quotes) {
            if(market == quote) {
                console.log(`Ignore ${market}/${quote}`);
                continue;
            }

            console.log(`Working on ${market}/${quote}`);
            let searchKey = `${market}-${quote}`;
            let reverse = false;
            let selectedFiles = allUniv3Files.filter(_ => _.startsWith(searchKey));
            if(selectedFiles.length == 0) {
                let searchKey = `${quote}-${market}`;
                reverse = true;
                selectedFiles = allUniv3Files.filter(_ => _.startsWith(searchKey));

                if(selectedFiles.length == 0) {
                    console.log(`Could not find univ3 files for ${market}/${quote}`);
                    continue;
                }
            }

            const destFilename = `./nocommit/compound/uniswapv3/${market}-${quote}_uniswapv3.csv`;
            fs.writeFileSync(destFilename, `block,reserve ${market},reserve ${quote},price,volume for slippage 5%\n`);

            console.log(`${market}/${quote}: found ${selectedFiles.length} files. ${selectedFiles.join(', ')}`);
            const dataContents = {};
            for(let i = 0; i< selectedFiles.length; i++) {
                dataContents[selectedFiles[i]] = {};
                const fileContent = fs.readFileSync('./data/uniswapv3/' + selectedFiles[i], 'utf-8').split('\n').splice(1);

                fileContent.pop();
                for(let j = 0; j < fileContent.length; j++) {
                    const blockNumber = Number(fileContent[j].split(',')[0]);
                    const jsonStr = fileContent[j].replace(`${blockNumber},`,'');
                    const parsed = JSON.parse(jsonStr);
                    dataContents[selectedFiles[i]][blockNumber] = parsed;
                }
            }
            
            // select base file = the file with the most lines
            let baseFile = selectedFiles[0];
            for(let i = 1; i < selectedFiles.length; i++) {
                const selectedFile = selectedFiles[i];
                if(Object.keys(dataContents[baseFile]).length < Object.keys(dataContents[selectedFile]).length) {
                    baseFile = selectedFile;
                }
            }

            const linesToWrite = [];
            for(const [blockNumber, dataObj] of Object.entries(dataContents[baseFile])) {

                const dataToWrite = {
                    blockNumber: Number(blockNumber),
                    price: reverse ? dataObj.p1vs0 : dataObj.p0vs1,
                    slippage5Pct: dataObj[`${market}-slippagemap`]['5'],
                };

                // sometimes there is not 5% slippage so we must search 4% slippage
                if(dataToWrite.slippage5Pct == undefined) {
                    dataToWrite.slippage5Pct = dataObj[`${market}-slippagemap`]['4'];
                }

                if(dataToWrite.slippage5Pct == undefined) {
                    console.log(`Data error on block ${blockNumber} for file ${baseFile}, ignoring block`);
                    continue;
                }

                // for each other files, select the line with the nearest block number
                for(let i = 0; i < selectedFiles.length; i++) {
                    const selectedFile = selectedFiles[i];
                    if(selectedFile == baseFile) {
                        continue;
                    }

                    // if the exact blocknumber if found, use it
                    if(dataContents[selectedFile][blockNumber]) {
                        let selectedFileSlippage = dataContents[selectedFile][blockNumber][`${market}-slippagemap`]['5'];
                        if(!selectedFileSlippage) {
                            selectedFileSlippage = dataContents[selectedFile][blockNumber][`${market}-slippagemap`]['4'];
                        }

                        dataToWrite.slippage5Pct += selectedFileSlippage;
                    } else {
                        // find nearest block under the current block
                        const selectedFileBlocks = Object.keys(dataContents[selectedFile]).map(_ => Number(_));
                        const nearestUnderBlock = selectedFileBlocks.filter(_ => _ < Number(blockNumber)).at(-1);
                        if(nearestUnderBlock) {
                            let selectedFileSlippage = dataContents[selectedFile][nearestUnderBlock][`${market}-slippagemap`]['5'];

                            if(selectedFileSlippage == undefined) {
                                selectedFileSlippage = dataContents[selectedFile][nearestUnderBlock][`${market}-slippagemap`]['4'];
                            }

                            if(selectedFileSlippage == undefined) {
                                console.log(`Data error on block ${nearestUnderBlock} for file ${selectedFile}, ignoring block`);
                            }

                            dataToWrite.slippage5Pct += selectedFileSlippage;
                        }
                    }
                }

                // here the data to write is ready to be written as it contains all the data from each files in the slippage field
                linesToWrite.push(`${dataToWrite.blockNumber},${0},${0},${dataToWrite.price},${dataToWrite.slippage5Pct}\n`);
            }
            
            fs.appendFileSync(destFilename, linesToWrite.join(''));
        }
    }
}

async function getCompoundAllMarkets() {

    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);

    const comptrollerContract = new ethers.Contract(comptrollerAddress, comptrollerAbi, web3Provider);
    const allMarkets = await comptrollerContract.getAllMarkets();
    const allMarketsTokens = [];
    for(const market of allMarkets) {
        console.log(market);
        if(marketToIgnore.includes(market)) {
            continue;
        } 

        const ctokenContract = new ethers.Contract(market, cTokenAbi, web3Provider);
        const underlying = await ctokenContract.underlying();

        if(market == cmkrAddress) {
            allMarketsTokens.push('MKR');
        } else {
            const erc20Contract = new ethers.Contract(underlying, erc20Abi, web3Provider);
            const symbol = await erc20Contract.symbol();
            console.log(market, underlying, symbol);
            allMarketsTokens.push(symbol);
        }
    }

    allMarketsTokens.push('WETH');

    fs.writeFileSync('compound_all_markets.json', JSON.stringify(allMarketsTokens, null, 2));

}


async function aggregUniswapData() {
    // const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    // const currentBlock = await web3Provider.getBlockNumber();
    // let allPromises = {};
    // const maxParallel = 8;
    // for(const base of compoundMarkets) {
    //     for(const quote of quotes) {

    //         if(base  == quote) {
    //             continue;
    //         }

    //         const promise = execAsync(`node ./scripts/uniswap_aggreg.js ${base} ${quote} ${currentBlock}`);

    //         console.log(`starting run for ${base}-${quote}`);
    //         allPromises[`${base}-${quote}`] = promise;

    //         if(Object.keys(allPromises).length >= maxParallel) {
    //             await Promise.race(Object.values(allPromises));
                
    //             for(const [key, value] of Object.entries(allPromises)) {
    //                 if(value.child.exitCode != null) {
    //                     console.log(`${key} run ended, removing`);
    //                     delete allPromises[key];
    //                 }
    //             }
    //         }            
    //     }
        
    // }

    // await Promise.all(Object.values(allPromises));

    for(const base of compoundMarkets) {

        // find all files for base
        const allFilesForBase = fs.readdirSync('./nocommit/compound/univ2v3').filter(_ => _.startsWith(base) && !_.includes('-full_'));

        console.log(`Found ${allFilesForBase.length} files for ${base}`);
        const allFileLines = [];
        for (const filename of allFilesForBase) {
            const fileContent = fs.readFileSync(`./nocommit/compound/univ2v3/${filename}`, 'utf-8').split('\n');
            allFileLines.push(fileContent);
        }

        const destFilename = path.join('./nocommit/compound/univ2v3', `${base}-full_uniswap_v2+v3.csv`);
        
        fs.writeFileSync(destFilename, `blocknumber,volume ${base} for 5% slippage\n`);

        const baseFileLines = allFileLines[0];
        for(let lineIndex = 1; lineIndex < baseFileLines.length - 1; lineIndex++) {
            const baseSplitted = baseFileLines[lineIndex].split(',');

            let baseBlockNumber = baseSplitted[0];
            let volume = Number(baseSplitted[3]);
            for(let fileIndex = 1; fileIndex < allFileLines.length; fileIndex++) {
                const splitted = allFileLines[fileIndex][lineIndex].split(',');
                let blockNumber = splitted[0];
                if(baseBlockNumber != blockNumber) {
                    throw new Error('!!!!!! BLOCKNUMBER MISMATCH !!!!!!!!');
                }
                // console.log(splitted);
                const fileVolume = Number(splitted[3]);
                volume += fileVolume;
            }

            // console.log(volume);
            fs.appendFileSync(destFilename, `${baseBlockNumber},${volume}\n`);
        }
    }


} 

async function main() {
    // await getCompoundAllMarkets();
    // await getUnivV2Pools();
    // generateTargetCsvForUniv2();

    // await getUnivV3Pools();

    // await getCurvePools();
    // generateTargetCsvForCurve();
    // generateTargetCsvForUniv3();
    await aggregUniswapData();
}
main();