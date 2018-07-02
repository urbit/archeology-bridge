'use strict';
var urbitCtrl = function($scope, $sce, $routeParams, $location, $rootScope, $timeout, walletService, concli) {
    // add route params to scope
    $scope.$routeParams = $routeParams;

    $rootScope.loadShips = true;

    $scope.concli = concli;

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
        $scope.concli.buildOwnedShips($scope.wallet.getAddressString(), $scope.ajaxReq, function(data) {
          $scope.tempOwnedShips = data;
          if (!angular.equals($scope.ownedShips, $scope.tempOwnedShips)) {
            // assign
            angular.copy($scope.tempOwnedShips, $scope.ownedShips);
          }
        });
      }
      if ($scope.polling) {
        $timeout(poll, 6000);
      } else {
        return;
      }
    };

    //Is creating/signing tx
    $scope.loading = false;

    $scope.ajaxReq = ajaxReq;

    $scope.visibility = "interactView";
    $scope.showReadWrite = false;

    // Use these in lieu of tx.* for offline transaction generation
    $scope.nonceDec;
    $scope.gasPriceDec;

    $scope.showRaw = false;

    $scope.$on('nodeChanged', function(e, d) {
      if ($scope.wallet) {
        $scope.concli.buildOwnedShips($scope.wallet.getAddressString(), $scope.ajaxReq, function(data) {
          $scope.tempOwnedShips = data;
          if (!angular.equals($scope.ownedShips, $scope.tempOwnedShips)) {
            // assign
            angular.copy($scope.tempOwnedShips, $scope.ownedShips);
          }
        });
      }
    });

    $scope.$watch(function() {
      if (walletService.wallet == null) return null;
      return walletService.wallet.getAddressString();
    }, function() {
      if (walletService.wallet == null) return;
      $scope.wallet = walletService.wallet;
      $scope.wd = true;
    });

    $scope.$watch('wallet', function(newVal, oldVal) {
      if (newVal) {
        $scope.concli.readOwnedShips($scope.wallet.getAddressString(), $scope.ajaxReq, function (data) {
          $scope.ownedShips = data;
        });
        $scope.readBalance();
      }
    });

    // this is for the initial load TODO clean this up
    $scope.$watch('ownedShips', function(newVal, oldVal) {
      if (newVal == oldVal || !newVal) {
        return;
      }
      var k = Object.keys(newVal);
      for (var i = 0; i < k.length; i ++) {
        $scope.concli.readShipData(k[i], $scope.ajaxReq, function(data) {
          $scope.ownedShips[data['ship']]['hasBeenBooted'] = data['hasBeenBooted'];
        });
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

    $scope.wipeTx = function() {
      $scope.rawTx = '';
      $scope.loading = false;
    }

    $scope.sendTx = function() {
      concli.sendTx($scope.signedTx, $scope.ajaxReq, function(data) {
        if (data.error) {
          $scope.notifier.danger(data.error.msg);
        } else {
          var bExStr = $scope.ajaxReq.type != nodes.nodeTypes.Custom ? "<a href='" + $scope.ajaxReq.blockExplorerTX.replace("[[txHash]]", data.data) + "' target='_blank' rel='noopener'> View your transaction </a>" : '';
          var contractAddr = data.data.tx.contractAddr != '' ? " & Contract Address <a href='" + ajaxReq.blockExplorerAddr.replace('[[address]]', data.data.tx.contractAddr) + "' target='_blank' rel='noopener'>" + data.data.tx.contractAddr + "</a>" : '';
          $scope.notifier.success(globalFuncs.successMsgs[2] + "<br />" + data.data + "<br />" + bExStr + contractAddr);
          $location.path('state');
          $scope.polling = true;
          poll();
          $scope.rawTx = '';
        }
      });
    }

    $scope.setPoolAddress = function(addr) {
      $rootScope.poolAddress = addr;
      $scope.poolAddress = $rootScope.poolAddress;
    }

    $scope.readBalance = function() {
      $scope.concli.readBalance($scope.poolAddress, $scope.ajaxReq, $scope.wallet, function(data) {
        $scope.balance = data;
      });
    }
    
    $scope.readHasOwner = function(ship) {
      $scope.concli.readHasOwner(ship, $scope.ajaxReq, function(data) {
        $scope.hasOwner = data;
      });
    }

    $scope.readIsOwner = function(ship, addr) {
      $scope.concli.readIsOwner(ship, addr, $scope.ajaxReq, function(data) {
        $scope.isOwner = data;
      });
    }

    $scope.readPoolAssets = function() {
      $scope.concli.readPoolAssets($scope.poolAddress, $scope.ajaxReq, function(data) {
        $scope.poolAssets = data;
        if ($scope.poolAssets.length > 0) {
          $scope.ship = $scope.poolAssets[0];
        } else {
          $scope.notifier.danger('This pool has no assets.');
        }
      });
    }

    $scope.readParent = function(ship) {
      $scope.concli.readParent(ship, $scope.ajaxReq, function(data) {
        $scope.parentShip = data;
      });
    }

    $scope.readIsRequestingEscapeTo = function(ship, sponsor) {
      $scope.concli.readIsRequestingEscapeTo(ship, sponsor, $scope.ajaxReq, function(data) {
        $scope.isEscape = data;
      });
    }

    $scope.readKey = function(ship) {
      $scope.concli.readKey(ship, $scope.ajaxReq, function(data) {
        $scope.key = data;
      });
    }

    $scope.readIsSpawnProxy = function(ship, addr) {
      $scope.concli.readIsSpawnProxy(ship, addr, $scope.ajaxReq, function(data) {
        $scope.isSpawnProxy = data;
      });
    }
    //
    // DO: do transactions that modify the blockchain
    //
    $scope.doCreateGalaxy = function(galaxy, address) {
      $scope.loading = true;
      $scope.concli.doCreateGalaxy(galaxy, address, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doDeposit = function(star) {
      $scope.loading = true;
      $scope.concli.doDeposit(star, $rootScope.poolAddress, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doWithdraw = function(star) {
      $scope.loading = true;
      $scope.concli.doWithdraw(star, $rootScope.poolAddress, $scope.wallet, $scope.ajaxReq, txHandler)
    }

    $scope.doSpawn = function(ship, addr) {
      $scope.loading = true;
      $scope.concli.doSpawn(ship, addr, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doSetSpawnProxy = function(ship, addr) {
      $scope.loading = true;
      $scope.concli.doSetSpawnProxy(ship, addr, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doConfigureKeys = function(ship, encryptionKey, authenticationKey, discontinuous) {
      $scope.loading = true;
      $scope.concli.doConfigureKeys(ship, encryptionKey, authenticationKey, discontinuous, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doTransferShip = function(ship, addr, reset) {
      $scope.loading = true;
      $scope.concli.doTransferShip(ship, addr, reset, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doSetTransferProxy = function(ship, addr) {
      $scope.loading = true;
      $scope.concli.doSetTransferProxy(ship, addr, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doEscape = function(ship, sponsor) {
      $scope.loading = true;
      $scope.concli.doEscape(ship, sponsor, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doAdopt = function(sponsor, escapee) {
      $scope.loading = true;
      $scope.concli.doAdopt(sponsor, escapee, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doReject = function(sponsor, escapee) {
      $scope.loading = true;
      $scope.concli.doReject(sponsor, escapee, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doApprove = function(address, ship) {
      $scope.loading = true;
      $scope.concli.doApprove(address, ship, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doSafeTransferFrom = function(fromAddr, toAddr, ship) {
      $scope.loading = true;
      $scope.concli.doSafeTransferFrom(fromAddr, toAddr, ship, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doCastConstitutionVote = function(galaxy, addr, vote) {
      $scope.loading = true;
      $scope.concli.doCastConstitutionVote(galaxy, addr, vote, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    $scope.doCastDocumentVote = function(galaxy, prop, vote) {
      $scope.loading = true;
      $scope.concli.doCastDocumentVote(galaxy, prop, vote, $scope.wallet, $scope.ajaxReq, txHandler);
    }

    var txHandler = function(data) {
      if (data.error) {
          $scope.notifier.danger(data.error.msg);
        } else {
          $scope.rawTx = data['rawTx'];
          $scope.signedTx = data['signedTx'];
          $scope.showRaw = data['showRaw'];
        }
    }
}
module.exports = urbitCtrl;
