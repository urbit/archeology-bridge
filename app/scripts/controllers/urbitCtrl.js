'use strict';
var urbitCtrl = function($scope, $sce, $routeParams, $location, $rootScope, $timeout, walletService, obService) {
    // add route params to scope
    $scope.$routeParams = $routeParams;

    $rootScope.loadShips = true;

    // ++  ob 
    $scope.ob = obService;

    //$scope.poolAddress;
    $scope.sparkBal = 0;

    //Offline status and poolAddress done through rootScope for persistence
    $scope.offline = $rootScope.offline;

    $scope.poolAddress = $rootScope.poolAddress;

    $scope.polling = false;
    // We do this to make sure that the poll has at least gone once
    $scope.pollCount = 0;

    var poll = function() {
      // If ownedShips is differnet from poll result
      if (!angular.equals($scope.ownedShips, $scope.tempOwnedShips) && $scope.tempOwnedShips && $scope.ownedShips) {
        // assign
        angular.copy($scope.tempOwnedShips, $scope.ownedShips);
      }
      if ($scope.pollCount > 0) {
          // stop pollling
          $scope.polling = false;
          $scope.pollCount = 0;
      }
      // Make sure there's a wallet loaded
      if ($scope.wallet) {
        $scope.pollCount +=1;
        $scope.readBalance();
        $scope.buildOwnedShips($scope.wallet.getAddressString());
      }
      if ($scope.polling) {
        $timeout(poll, 6000);
      } else {
        return;
      }
    };

    //Is creating/signing tx
    $scope.loading = false;

    $scope.contracts = {};
    $scope.contracts.ships = "0xe0834579269eac6beca2882a6a21f6fb0b1d7196";
    $scope.contracts.polls = "0x0654b24a5da81f6ed1ac568e802a9d6b21483561";
    $scope.contracts.pool  = "0x0724ee9912836c2563eee031a739dda6dd775333";
    //$scope.contracts.constitution = '0x56db68f29203ff44a803faa2404a44ecbb7a7480';
    $scope.contracts.constitution = '0x098b6cb45da68c31c751d9df211cbe3056c356d1'

    $scope.ajaxReq = ajaxReq;
    $scope.visibility = "interactView";
    $scope.showReadWrite = false;
    $scope.Validator = Validator;
    $scope.oneSpark = 1000000000000000000;
    $scope.tx = {
        gasLimit: '',
        data: '',
        to: '',
        unit: "ether",
        value: 0,
        nonce: null,
        gasPrice: null
    }

    // Use these in lieu of tx.* for offline transaction generation
    $scope.nonceDec;
    $scope.gasPriceDec;

    $scope.contract = {
        address: globalFuncs.urlGet('address') != null && $scope.Validator.isValidAddress(globalFuncs.urlGet('address')) ? globalFuncs.urlGet('address') : '',
        abi: '',
        functions: [],
        selectedFunc: null
    }
    //$scope.selectedAbi = ajaxReq.abiList[0];
    $scope.showRaw = false;
    $scope.$on('nodeChanged', function(e, d) {
      if ($scope.wallet) {
        $scope.buildOwnedShips($scope.wallet.getAddressString());
      }
    });
    $scope.$watch(function() {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function() {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
        $scope.wd = true;
        $scope.tx.nonce = 0;
    });
    $scope.$watch('wallet', function(newVal, oldVal) {
      if (newVal) {
        $scope.readOwnedShips(newVal.getAddressString());
        $scope.readBalance();
      }
    });
    $scope.$watch('visibility', function(newValue, oldValue) {
        $scope.tx = {
            gasLimit: '',
            data: '',
            to: '',
            unit: "ether",
            value: 0,
            nonce: null,
            gasPrice: null
        }

    });
    $scope.$watch('contract.address', function(newValue, oldValue) {
        if ($scope.Validator.isValidAddress($scope.contract.address)) {
            for (var i in ajaxReq.abiList) {
                if (ajaxReq.abiList[i].address.toLowerCase() == $scope.contract.address.toLowerCase()) {
                    $scope.contract.abi = ajaxReq.abiList[i].abi;
                    break;
                }
            }
        }
    });
    // this is for the initial load TODO clean this up
    $scope.$watch('ownedShips', function(newVal, oldVal) {
      if (newVal == oldVal) {
        return;
      }
      var k = Object.keys(newVal);
      for (var i = 0; i < k.length; i ++) {
        $scope.readShipData(k[i]);
      };
    });
    $scope.$watch('rawTx', function(newVal, oldVal) {
      if (newVal == oldVal) {
        return;
      }
      $scope.loading = false;
    });
    $scope.path = function(path) {
      $location.path(path);
    }
    $scope.toWei = function(ether) {
      return etherUnits.toWei(ether, "ether");
    }
    $scope.toEther = function(wei) {
      return etherUnits.toEther(wei, "wei");
    }
    $scope.selectExistingAbi = function(index) {
        $scope.selectedAbi = ajaxReq.abiList[index];
        $scope.contract.address = $scope.selectedAbi.address;
        $scope.addressDrtv.ensAddressField = $scope.selectedAbi.address;
        $scope.addressDrtv.showDerivedAddress = false;
        $scope.dropdownExistingContracts = false;
        $scope.contract.selectedFunc=null
        $scope.dropdownContracts = false;

        if ($scope.initContractTimer) clearTimeout($scope.initContractTimer);
        $scope.initContractTimer = setTimeout(function() {
            $scope.initContract();
        }, 50);
    }

    $scope.generateTxOffline = function() {
        if (!ethFuncs.validateEtherAddress($scope.tx.to)) {
            $scope.notifier.danger(globalFuncs.errorMsgs[5]);
            return;
        }
        var txData = uiFuncs.getTxData($scope);
        txData.isOffline = true;
        txData.nonce = ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.nonceDec));
        txData.gasPrice = ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.gasPriceDec));
        if ($scope.tokenTx.id != 'ether') {
            txData.data = $scope.tokenObjs[$scope.tokenTx.id].getData($scope.tx.to, $scope.tx.value).data;
            txData.to = $scope.tokenObjs[$scope.tokenTx.id].getContractAddress();
            txData.value = '0x00';
        }
        uiFuncs.generateTx(txData, function(rawTx) {
            if (!rawTx.isError) {
                $scope.rawTx = rawTx.rawTx;
                $scope.signedTx = rawTx.signedTx;
                $scope.showRaw = true;
            } else {
                $scope.showRaw = false;
                $scope.notifier.danger(rawTx.error);
            }
            if (!$scope.$$phase) $scope.$apply();
        });
    }

    $scope.generateTx = function() {
        try {
            if ($scope.wallet == null)
            { throw globalFuncs.errorMsgs[3]; }
            else if (!ethFuncs.validateHexString($scope.tx.data))
            { throw globalFuncs.errorMsgs[9]; }
            else if (!globalFuncs.isNumeric($scope.tx.gasLimit) || parseFloat($scope.tx.gasLimit) <= 0)
            { throw globalFuncs.errorMsgs[8]; }
            $scope.tx.data = ethFuncs.sanitizeHex($scope.tx.data);
            ajaxReq.getTransactionData($scope.wallet.getAddressString(), function(data) {
                if (data.error) $scope.notifier.danger(data.msg);
                data = data.data;
                $scope.tx.to = $scope.tx.to == '' ? '0xCONTRACT' : $scope.tx.to;
                $scope.tx.contractAddr = $scope.tx.to == '0xCONTRACT' ? ethFuncs.getDeteministicContractAddress($scope.wallet.getAddressString(), data.nonce) : '';
                var txData = uiFuncs.getTxData($scope);
                uiFuncs.generateTx(txData, function(rawTx) {
                    if (!rawTx.isError) {
                        $scope.rawTx = rawTx.rawTx;
                        $scope.signedTx = rawTx.signedTx;
                        $scope.showRaw = true;
                    } else {
                        $scope.showRaw = false;
                        $scope.notifier.danger(rawTx.error);
                    }
                    if (!$scope.$$phase) $scope.$apply();
                });
            });
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.wipeTx = function() {
        $scope.rawTx = '';
        $scope.loading = false;
    }
    $scope.sendTx = function() {
        // need some way to show error or success
        uiFuncs.sendTx($scope.signedTx, function(resp) {
            if (!resp.isError) {
                var bExStr = $scope.ajaxReq.type != nodes.nodeTypes.Custom ? "<a href='" + $scope.ajaxReq.blockExplorerTX.replace("[[txHash]]", resp.data) + "' target='_blank' rel='noopener'> View your transaction </a>" : '';
                var contractAddr = $scope.tx.contractAddr != '' ? " & Contract Address <a href='" + ajaxReq.blockExplorerAddr.replace('[[address]]', $scope.tx.contractAddr) + "' target='_blank' rel='noopener'>" + $scope.tx.contractAddr + "</a>" : '';
                $scope.notifier.success(globalFuncs.successMsgs[2] + "<br />" + resp.data + "<br />" + bExStr + contractAddr);

                $location.path('state');
                $scope.polling = true;
                poll();
                $scope.rawTx = '';
            } else {
                $scope.notifier.danger(resp.error);
            }
        });
    }
    $scope.setVisibility = function(str) {
        $scope.visibility = str;
    }
    $scope.selectFunc = function(index) {
        $scope.contract.selectedFunc = { name: $scope.contract.functions[index].name, index: index };
        if (!$scope.contract.functions[index].inputs.length) {
            $scope.readFromContract();
            $scope.showRead = false;
        } else $scope.showRead = true;
        $scope.dropdownContracts = !$scope.dropdownContracts;
    }
    $scope.getTxData = function() {
        var curFunc = $scope.contract.functions[$scope.contract.selectedFunc.index];
        var fullFuncName = ethUtil.solidityUtils.transformToFullName(curFunc);
        var funcSig = ethFuncs.getFunctionSignature(fullFuncName);
        var typeName = ethUtil.solidityUtils.extractTypeName(fullFuncName);
        var types = typeName.split(',');
        types = types[0] == "" ? [] : types;
        var values = [];
        for (var i in curFunc.inputs) {
            if (curFunc.inputs[i].value) {
                if (curFunc.inputs[i].type.indexOf('[') !== -1 && curFunc.inputs[i].type.indexOf(']') !== -1) values.push(curFunc.inputs[i].value.split(','));
                else values.push(curFunc.inputs[i].value);
            } else values.push('');
        }
        return '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, values);
    }
    $scope.readFromContract = function() {
        ajaxReq.getEthCall({ to: $scope.contract.address, data: $scope.getTxData() }, function(data) {
            if (!data.error) {
                var curFunc = $scope.contract.functions[$scope.contract.selectedFunc.index];
                var outTypes = curFunc.outputs.map(function(i) {
                    return i.type;
                });
                var decoded = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''));
                for (var i in decoded) {
                    if (decoded[i] instanceof BigNumber) curFunc.outputs[i].value = decoded[i].toFixed(0);
                    else curFunc.outputs[i].value = decoded[i];
                }
            } else throw data.msg;

        });
    }
    $scope.initContract = function() {
        try {
            if (!$scope.Validator.isValidAddress($scope.contract.address)) throw globalFuncs.errorMsgs[5];
            else if (!$scope.Validator.isJSON($scope.contract.abi)) throw globalFuncs.errorMsgs[26];
            $scope.contract.functions = [];
            var tAbi = JSON.parse($scope.contract.abi);
            for (var i in tAbi)
                if (tAbi[i].type == "function") {
                    tAbi[i].inputs.map(function(i) { i.value = ''; });
                    $scope.contract.functions.push(tAbi[i]);
                }
            $scope.showReadWrite = true;

        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.generateContractTx = function() {
        if (!$scope.wd) {
            $scope.notifier.danger(globalFuncs.errorMsgs[3]);
            return;
        }
        $scope.tx.data = $scope.getTxData();
        $scope.tx.to = $scope.contract.address;
        //$scope.sendContractModal.open();
        // just generate the transaction
        $scope.generateTx();
    }
    //
    $scope.buildTransactionData = function(func, input) {
        var funcSig = ethFuncs.getFunctionSignature(func);
        var typeName = ethUtil.solidityUtils.extractTypeName(func);
        var types = typeName.split(',');
        types = types[0] == "" ? [] : types;
        return '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, input);
    }
    //NOTE value is expected in wei
    $scope.doTransaction = function(address, func, input, value) {
      if ($scope.wallet == null) {
        return;
      }
      var data = $scope.buildTransactionData(func, input);
      $scope.tx.data = data;
      $scope.tx.value = value || 0;
      $scope.tx.unit = "wei";
      if (!$scope.offline) {
        var estObj = {
          from: $scope.wallet.getAddressString(),
          value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.tx.value)),
          data: ethFuncs.sanitizeHex(data),
        }
        estObj.to = address;
        ethFuncs.estimateGas(estObj, function(data) {
          if (data.error) {
            console.log("Gas estimation error");
            // Proper input validation should prevent this.
          } else {
            // to not fall victim to inaccurate estimates, allow slightly more gas to be used.
            //TODO 1.8 is a bit much though. consult experts on why this can be so
            //     unpredictable, and how to fix it.
            $scope.tx.gasLimit = Math.round(data.data * 1.8);
            try {
              if ($scope.wallet == null)
              { throw globalFuncs.errorMsgs[3]; }
              else if (!ethFuncs.validateHexString($scope.tx.data))
              { throw globalFuncs.errorMsgs[9]; }
              else if (!globalFuncs.isNumeric($scope.tx.gasLimit) || parseFloat($scope.tx.gasLimit) <= 0)
              { throw globalFuncs.errorMsgs[8]; }
              $scope.tx.data = ethFuncs.sanitizeHex($scope.tx.data);
              ajaxReq.getTransactionData($scope.wallet.getAddressString(), function(data) {
                if (data.error) $scope.notifier.danger(data.msg);
                data = data.data;
                $scope.tx.to = address;
                $scope.tx.contractAddr = $scope.tx.to;
                $scope.showRaw = false;
                //$scope.sendContractModal.open();
                // just generate transaction with default amount and gas
                $scope.generateTx();
              });
            } catch (e) {
              $scope.notifier.danger(e);
            }
          }
        });
      } else {
        $scope.tx.to = address;
        $scope.tokenTx = {
            to: '',
            value: 0,
            id: 'ether',
            gasLimit: 150000
        };
        $scope.localToken = {
            contractAdd: "",
            symbol: "",
            decimals: "",
            type: "custom",
        };
        $scope.generateTxOffline();
      }
    }
    $scope.readContractData = function(address, func, input, outTypes, callback) {
        $scope.contract.address = address;
        var call = $scope.buildTransactionData(func, input);
        ajaxReq.getEthCall({ to: $scope.contract.address, data: call }, function(data) {
          if (!data.error) {
            var decoded = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''));
            for (var i in decoded) {
              if (decoded[i] instanceof BigNumber) decoded[i] = decoded[i].toFixed(0);
            }
            callback(decoded);
          } else throw data.msg;
        });
    }
    //$scope.loadAddresses = function() {
    //  $scope.contracts = {};
    //  $scope.contracts.ships = "0xe0834579269eac6beca2882a6a21f6fb0b1d7196";
    //  $scope.contracts.votes = "0x0654b24a5da81f6ed1ac568e802a9d6b21483561";
    //  $scope.contracts.spark = "0x56db68f29203ff44a803faa2404a44ecbb7a7480";
    //  $scope.contracts.constitution = '0x56db68f29203ff44a803faa2404a44ecbb7a7480';
    //}
    ////
    //// VALIDATE: validate input data
    ////
    $scope.validateShip = function(ship, next) {
      if (ship < 0 || ship > 4294967295)
        return $scope.notifier.danger("Ship " + ship + " not a galaxy, star or planet.");
      return next();
    }
    $scope.validateParent = function(ship, next) {
      if (ship < 0 || ship > 65535)
        return $scope.notifier.danger("Ship " + ship + " not a galaxy or star.");
      return next();
    }
    $scope.validateChild = function(ship, next) {
      if (ship < 256 || ship > 4294967295)
        return $scope.notifier.danger("Ship " + ship + " not a star or planet.");
      return next();
    }
    $scope.validateGalaxy = function(galaxy, next) {
      if (galaxy < 0 || galaxy > 255)
        return $scope.notifier.danger("Ship " + galaxy + " not a galaxy.");
      return next();
    }
    $scope.validateStar = function(star, next) {
      if (star < 256 || star > 65535)
        return $scope.notifier.danger("Ship " + star + " not a star.");
      return next();
    }
    $scope.validateAddress = function(address, next) {
      if (!ethFuncs.validateEtherAddress(address))
        return $scope.notifier.danger(address + " is not a valid Ethereum address.");
      return next();
    }
    $scope.validateTimestamp = function(timestamp, next) {
      if (timestamp < 0 || timestamp > 4200000000)
        return $scope.notifier.danger("Weird timestamp: " + timestamp);
      return next();
    }
    $scope.validateBytes32 = function(bytes, next) {
      if (bytes.length > 32)
        return $scope.notifier.danger("Input too long: " + bytes);
      return next();
    }
    //
    // UI Validators
    //
    $scope.valGalaxy = function(galaxy) {
      if (galaxy < 0 || galaxy > 255 || typeof galaxy !== 'number') {
        return true;
      } else {
        return false;
      }
    }

    $scope.valStar = function(star) {
      if (star < 256 || star > 65535 || typeof star !== 'number') {
        return true;
      } else {
        return false;
      }
    }
    $scope.valShip = function(ship) {
      if (ship < 0 || ship > 4294967295 || typeof ship !== 'number') {

        return true;
      } else {
        return false;
      }
    }

    $scope.valAddress = function(address) {
      if (!ethFuncs.validateEtherAddress(address)) {
        return true;
      } else {
        return false;
      }
    }

    $scope.valTimestamp = function(timestamp) {
      if (timestamp < 0 || timestamp > 4200000000) {
        return true;
      } else {
        return false;
      }
    }

    //
    //UI Conviences
    //
    $scope.isPast = function(secs) {
      if (!secs) {
        return false
      }
      return secs <= (Date.now() / 1000);
    }
    $scope.remainingSecs = function(secs) {
      return secs - (Date.now() / 1000);
    }
    $scope.secToString = function(secs) {
      if (secs <= 0) {
        return 'Completed';
      }
      secs = Math.round(secs)
      var min = 60;
      var hour = 60 * min;
      var day = 24 * hour;
      var week = 7 * day;
      var year = 52 * week;
      var fy = function(s) {
        if (s < year) {
          return ['', s];
        } else {
          return [Math.round(s / year) + 'y', s % year];
        }
      }
      var fw = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < week) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / week) + 'w', sec % week];
        }
      }
      var fd = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < day) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / day) + 'd', sec % day];
        }
      }
      var fh = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < hour) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / hour) + 'h', sec % hour];
        }
      }
      var fm = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < min) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / min) + 'm', sec % min];
        }
      }
      var fs = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        return str + ' ' + sec + 's';
      }
      return fs(fm(fh(fd(fw(fy(secs)))))).trim();
    }

    $scope.formatShipName = function(ship) {
      if (!ship) {
        return ship;
      } 
      if (ship.length < 2) {
        return ship;
      }
      if (ship[0] != '~') {
        return '~' + ship;
      } else {
        return ship;
      }
    }

    $scope.buildOwnedShips = function(address) {
      $scope.tmp = {}
      // zero out struct?
      $scope.getOwnedShips(address, function(data) {
        // if no ships returns, just zero this out, otherwise, wait until all 
        // ships have loaded
        if (data[0].length < 1) {
          $scope.ownedShips = {};
        }
        var x = data[0]
        for (var i in x) {
          if (i == x.length - 1) {
            // transfer shiplist once built
            $scope.buildShipData(x[i], true);
          } else {
            // transfer shiplist once built
            $scope.buildShipData(x[i], false);
          }
        }
      });
    }

    $scope.buildShipData = function(address, terminate) {
      function put(data) {
        $scope.tmp[address] = {};
        $scope.tmp[address]['name'] = '~' + $scope.toShipName(address);
        $scope.tmp[address]['address'] = address;
        $scope.tmp[address]['hasBeenBooted'] = data[0];
        if (terminate) {
          $scope.tempOwnedShips = $scope.tmp;
          if (!angular.equals($scope.ownedShips, $scope.tempOwnedShips)) {
            // assign
            angular.copy($scope.tempOwnedShips, $scope.ownedShips);
          }
        }
      }
      $scope.getHasBeenBooted(address, put);
    }

    $scope.setPoolAddress = function(x) {
      $rootScope.poolAddress = x;
      $scope.poolAddress = $rootScope.poolAddress;
    }

    $scope.toShipName = function(address) {
      if (address > -1 && address < 256) {
        return $scope.ob.toGalaxyName(address);
      } else if (address > 255 && address < 65536) {
        return $scope.ob.toStarName(address);
      } else {
        return $scope.ob.toPlanetName(address);
      }
    };

    $scope.getSpawnCandidate = function(address) {
      $scope.hasOwner = true;
      var candidate;
      if (address > -1 && address < 256) {
        candidate = ((Math.floor(Math.random() * 255) + 1) * 256 + address);
        return candidate;
      } else if (address > 255 && address < 65536) {
        candidate = ((Math.floor(Math.random() * 65535) + 1) * 65536 + address);
        return candidate;
      } else {
        return;
      }
    };

    $scope.generateShipList = function(shipListString, cb) {
      var t = shipListString.split('\n');
      var r = {};
      for (var i = 0; i < t.length; i ++) {
        if (t[i]) {
          r[t[i]] = { address: t[i], name: '~' + $scope.toShipName(t[i])};
        }
      };
      if (cb) {
        cb(r);
      } else {
        return r;
      }
    };
    //
    // GET: read contract data, pass the result to callback
    //
    $scope.getConstitutionOwner = function(callback) {
      $scope.readContractData($scope.contracts.constitution,
        "owner()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getVotesAddress = function(callback) {
      $scope.readContractData($scope.contracts.constitution,
        "votes()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getShipsOwner = function(callback) {
      $scope.readContractData($scope.contracts.ships,
        "owner()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getOwnedShips = function(address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getOwnedShipsByAddress(address)",
        [address],
        ["uint32[]"],
        callback
      );
    }
    $scope.getOwner = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getOwner(uint32)",
        [ship],
        ["address"],
        callback
      );
    }
    $scope.getIsOwner = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isOwner(uint32,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getIsActive = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isActive(uint32)",
        [ship],
        ["bool"],
        callback
      );
    }
    $scope.getSponsor = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getSponsor(uint32)",
        [ship],
        ["uint32"],
        callback
      );
    }
    $scope.getIsRequestingEscapeTo = function(ship, sponsor, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isRequestingEscapeTo(uint32,uint32)",
        [ship, sponsor],
        ["bool"],
        callback
      );
    }
    $scope.getHasBeenBooted = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "hasBeenBooted(uint32)",
        [ship],
        ["bool"],
        callback
      );
    }
    $scope.getKey = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getKey(uint32)",
        [ship],
        ["bytes32"],
        callback
      );
    }
    $scope.getIsTransferProxy = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isTransferProxy(uint32,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getIsSpawnProxy = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isSpawnProxy(uint32,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getEscapeRequest = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getEscapeRequest(uint32)",
        [ship],
        ["uint32"],
        callback
      );
    }
    $scope.getTransferringFor = function(address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getTransferringFor(address)",
        [ship],
        ["uint32[]"],
        callback
      );
    }
    $scope.getPoolAssets = function(callback) {
      $scope.readContractData($rootScope.poolAddress,
        "getAllAssets()",
        [],
        ["uint16[]"],
        callback
      );
    }
    $scope.getSparkBalance = function(callback) {
      $scope.readContractData($rootScope.poolAddress,
        "balanceOf(address)",
        [$scope.wallet.getAddressString()],
        ["uint256"],
        callback
      );
    }
    $scope.getHasVotedOnConstitutionPoll = function(galaxy, address, callback) {
      $scope.readContractData($scope.contracts.polls,
        "hasVotedOnConstitutionPoll(uint8,address)",
        [galaxy, address],
        ["bool"],
        callback
      );
    }
    $scope.getDocumentHasAchievedMajority = function(proposal, callback) {
      $scope.readContractData($scope.contracts.polls,
        "documentHasAchievedMajority(bytes32)",
        [proposal],
        ["bool"],
        callback
      );
    }
    $scope.getHasVotedOnDocumentPoll = function(galaxy, proposal, callback) {
      $scope.readContractData($scope.contracts.polls,
        "hasVotedOnDocumentPoll(uint8,bytes32)",
        [galaxy, proposal],
        ["bool"],
        callback
      );
    }
    //
    // READ: fill fields with requested data
    //
    $scope.readShipData = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getHasBeenBooted(ship, put);
      });
      function put(data) {
        $scope.ownedShips[ship]['hasBeenBooted'] = data[0];
      }
    }
    $scope.readOwnedShips = function(addr) {
      if (!addr) {
        return;
      }
      $scope.getOwnedShips(addr, function(data) {
        var res = "";
        for (var i in data[0]) {
          res = res + data[0][i] + "\n";
        }
        $scope.ownedShips = $scope.generateShipList(res);
      });
    }
    $scope.readHasOwner = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getOwner(ship, put);
      });
      function put(data) {
        $scope.hasOwner = data[0] == '0x0000000000000000000000000000000000000000' ? false : true;
      }
    }
    $scope.readIsOwner = function(ship, addr) {
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          $scope.getIsOwner(ship, addr, put);
        });
      });
      function put(data) {
        // not 100% that this is bool
        $scope.isOwner = data[0];
      }
    }
    $scope.readPoolAssets = function() {
      $scope.getPoolAssets(put);
      function put(data) {
        var t = [];
        for (var i = 0; i < data[0].length; i++) {
            t.push($scope.formatShipName($scope.toShipName(data[0][i].toFixed(0))));
        }
        $scope.poolAssets = t;
        if ($scope.poolAssets.length > 0) {
          $scope.ship = $scope.poolAssets[0];
        } else {
          // trigger an error?
        }
      };
    }
    $scope.readParent = function(ship) {
      $scope.validateChild(ship, function() {
        $scope.getSponsor(ship, put);
      });
      function put(data) {
        $scope.parentShip = data[0];
      }
    }
    $scope.readIsRequestingEscapeTo = function(ship, sponsor) {
      $scope.validateChild(ship, function() {
        $scope.validateParent(sponsor, function () {
          $scope.getIsRequestingEscapeTo(ship, sponsor, put);
        });
      });
      function put(data) {
        $scope.isEscape = data[0];
      }
    }
    $scope.readKey = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getKey(ship, put);
      });
      function put(data) {
        $scope.key = data[0];
      }
    }
    $scope.readIsSpawnProxy = function(ship, addr) {
      $scope.validateParent(ship, function() {
        $scope.validateAddress(addr, function () {
          $scope.getIsSpawnProxy(ship, addr, put);
        });
      });
      function put(data) {
        $scope.isSpawnProxy = data[0];
      }
    }
    $scope.readBalance = function() {
      if ($rootScope.poolAddress) {
        $scope.getSparkBalance(function(data) {
          $scope.balance = data[0] / $scope.oneSpark;
        });
      } else {
        // throw an error here
      }
    }
    //
    // CHECK: verify if conditions for a transaction are met
    //
    $scope.checkOwnership = function(ship, next) {
      $scope.getIsOwner(ship, $scope.wallet.getAddressString(), function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Not your ship. " + ship);
      });
    }
    $scope.checkIsTransferProxy = function(ship, addr, next) {
      $scope.getIsTransferProxy(ship, addr, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Ship is not transferable by " + addr);
      });
    }
    $scope.checkIsUnlocked = function(ship, next) {
      $scope.getIsActive(ship, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Ship is not active.");
      });
    }
    $scope.checkIsLatent = function(ship, next) {
      $scope.getIsActive(ship, function(data) {
        if (!data[0]) return next();
        $scope.notifier.danger("Ship is active.");
      });
    }
    $scope.checkEscape = function(ship, sponsor, next) {
      $scope.getIsRequestingEscapeTo(ship, sponsor, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Escape doesn't match.");
      });
    }
    //
    // DO: do transactions that modify the blockchain
    //
    $scope.doCreateGalaxy = function(galaxy, address) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateAddress(address, function() {
          if ($scope.offline) return transact();
          $scope.getConstitutionOwner(checkPermission);
        });
      });
      function checkPermission(data) {
        if (data[0] != $scope.wallet.getAddressString())
          return $scope.notifier.danger("Insufficient permissions.");
        $scope.getIsOwner(galaxy, address, checkAvailable);
      }
      function checkAvailable(data) {
        if (data[0].length > 0)
          return $scope.notifier.danger("Galaxy already owned.");
        transact();
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "createGalaxy(uint8,address)",
          [galaxy, address]
        );
      }
    }
    $scope.doDeposit = function(star) {
      $scope.loading = true;
      $scope.validateStar(star, function() {
        if ($scope.offline) return transact();
          $scope.checkIsTransferProxy(star, $rootScope.poolAddress, function() {
            $scope.checkOwnership(star, checkHasNotBeenBooted);
          });
      });
      // star cannot be booted
      function checkHasNotBeenBooted() {
        $scope.getHasBeenBooted(star, function(data) {
          if (data[0])
            return $scope.notifier.danger("Ship has been booted.");
          transact();
        });
      }
      function transact() {
        // will this bork if you enter a new pool address on the deposit screen?
        $scope.doTransaction($rootScope.poolAddress,
          "deposit(uint16)",
          [star]
        );
      }
    }
    $scope.doWithdraw = function(star) {
      $scope.loading = true;
      $scope.validateStar(star, function() {
        return transact();
      });
      function transact() {
        $scope.doTransaction($rootScope.poolAddress,
          "withdraw(uint16)",
          [star]
        );
      }
    }
    $scope.doSpawn = function(ship, addr) {
      $scope.loading = true;
      var sponsor = ship % 256;
      if (ship > 65535) sponsor = ship % 65536;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkIsLatent(ship, checkHasBeenBooted);
        });
      });
      // sponsor must have been booted in order to spawn ship
      function checkHasBeenBooted() {
        $scope.getHasBeenBooted(sponsor, function(data) {
          if (!data[0])
            return $scope.notifier.danger("Ship has not been booted.");
          checkParent();
        });
      }
      // ship needs to be galaxy, or its parent needs to be living
      function checkParent() {
        if (ship < 256) return checkRights();
        $scope.checkIsUnlocked(sponsor, checkRights);
      }
      // user needs to be owner of sponsor or spawn proxy of sponsor
      function checkRights() {
        $scope.getIsSpawnProxy(sponsor, $scope.wallet.getAddressString(),
        function(data) {
          if (data[0]) return transact();
          $scope.checkOwnership(sponsor, transact);
        });
      }

      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "spawn(uint32,address)",
          [ship, addr]
        );
      }
    }
    $scope.doSetSpawnProxy = function(ship, addr) {
      $scope.loading = true;
      $scope.validateParent(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, function() {
            $scope.checkIsUnlocked(ship, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "setSpawnProxy(uint16,address)",
          [ship, addr]
        );
      }
    }
    $scope.doConfigureKeys = function(ship, encryptionKey, authenticationKey, discontinuous) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateBytes32(encryptionKey, function() {
          $scope.validateBytes32(authenticationKey, function() {
            if ($scope.offline) return transact();
            $scope.checkOwnership(ship, function() {
              $scope.checkIsUnlocked(ship, transact);
            });
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "configureKeys(uint32,bytes32,bytes32,bool)",
          [ship, encryptionKey, authenticationKey, discontinuous]
        );
      }
    }
    $scope.doTransferShip = function(ship, addr, reset) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "transferShip(uint32,address,bool)",
          [ship, addr, reset]
        );
      }
    }
    $scope.doSetTransferProxy = function(ship, addr) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "setTransferProxy(uint32,address)",
          [ship, addr]
        );
      }
    }
    $scope.doEscape = function(ship, sponsor) {
      $scope.loading = true;
      $scope.validateChild(ship, function() {
        $scope.validateParent(sponsor, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "escape(uint32,uint32)",
          [ship, sponsor]
        );
      }
    }
    $scope.doAdopt = function(sponsor, escapee) {
      $scope.loading = true;
      $scope.validateParent(sponsor, function() {
        $scope.validateChild(escapee, function () {
          if ($scope.offline) return transact();
          $scope.checkOwnership(escapee, function() {
            $scope.checkEscape(escapee, sponsor, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "adopt(uint32,uint32)",
          [sponsor, escapee]
        );
      }
    }
    $scope.doReject = function(sponsor, escapee) {
      $scope.loading = true;
      $scope.validateParent(sponsor, function() {
        $scope.validateChild(escapee, function () {
          if ($scope.offline) return transact();
          $scope.checkOwnership(escapee, function() {
            $scope.checkEscape(escapee, sponsor, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "reject(uint32,uint32)",
          [sponsor, escapee]
        );
      }
    }
    $scope.doApprove = function(address, ship) {
      $scope.loading = true;
      $scope.validateAddress(address, function () {
        if ($scope.offline) return transact();
        $scope.checkOwnership(ship, transact);
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "approve(address,uint256)",
          [address, ship]
        );
      }
    }
    $scope.doSafeTransferFrom = function(fromAddr, toAddr, ship) {
      $scope.loading = true;
      $scope.validateAddress(fromAddr, function () {
        $scope.validateAddress(toAddr, function () {
          $scope.validateShip(ship, function () {
            if ($scope.offline) return transact();
            // TODO: add check to validate that the caller has been approved to initiate transfer
            transact();
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "safeTransferFrom(address,address,uint256)",
          [fromAddr, toAddr, ship]
        );
      }
    }
    $scope.doCastConstitutionVote = function(galaxy, addr, vote) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(galaxy, function() {
            $scope.checkIsUnlocked(galaxy, function() {
              $scope.getHasVotedOnConstitutionPoll(galaxy, addr, checkVote);
            });
          });
        });
      });
      function checkVote(data) {
        if (!data[0]) return transact();
        $scope.notifier.danger("Vote already registered.");
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "castConstitutionVote(uint8,address,bool)",
          [galaxy, addr, vote]
        );
      }
    }
    $scope.doCastDocumentVote = function(galaxy, prop, vote) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateBytes32(prop, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(galaxy, function() {
            $scope.checkIsUnlocked(galaxy, function() {
              $scope.getDocumentHasAchievedMajority(prop, checkMajority);
            });
          });
        });
      });
      function checkMajority(data) {
        if (!data[0]) return $scope.getHasVotedOnDocumentPoll(galaxy, prop, checkVote);
        return $scope.notifier.danger("Document already has majority.");
      }
      function checkVote(data) {
        if (!data[0]) return transact();
        $scope.notifier.danger("Vote already registered.");
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "castDocumentVote(uint8,bytes32,bool)",
          [galaxy, prop, vote]
        );
      }
    }
}
module.exports = urbitCtrl;
