'use strict';
var urbitCtrl = function($scope, $sce, $routeParams, $location, $rootScope, $timeout, walletService) {
  // add route params to scope
  $scope.$routeParams = $routeParams;

  $rootScope.loadShips = true;

  $scope.balance = 0;
  $scope.ownedShips = {};
  $scope.pendingTransferShips = [];

  //Offline status and poolAddress done through rootScope for persistence
  $scope.offline = $rootScope.offline;

  $scope.poolAddress = $rootScope.poolAddress;

  $scope.pendingTransfers = false;

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
      $scope.getOwnedShips();
      $scope.getTransferringShips();
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
      $scope.getOwnedShips();
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
      $scope.getOwnedShips();
      $scope.getTransferringShips();
      $scope.readBalance();
    }
  });

  // this is for the initial load TODO clean this up
  $scope.$watch('ownedShips', function(newVal, oldVal) {
    if (newVal == oldVal || !newVal) {
      return;
    }
    console.log('watch owned ships');
  });

  $scope.$watch('rawTx', function(newVal, oldVal) {
    if (newVal == oldVal) {
      return;
    }
    $scope.loading = false;
  });

  $scope.getOwnedShips = function() {
    $scope.constitution.readOwnedShipsStatus($scope.wallet.getAddressString(), function(res) {
        $scope.tempOwnedShips = res.data;
        if (!angular.equals($scope.ownedShips, $scope.tempOwnedShips)) {
          angular.copy($scope.tempOwnedShips, $scope.ownedShips);
        }
        $scope.$apply();
      });
  }

  $scope.getTransferringShips = function() {
    $scope.constitution.readTransferringFor($scope.wallet.getAddressString(), function(res) {
        $scope.tempPendingTransferShips = res.data;
        if ($scope.tempPendingTransferShips.length > 0) $scope.pendingTransfers = true;
        else $scope.pendingTransfers = false;
        if (!angular.equals($scope.pendingTransferShips, $scope.tempPendingTransferShips)) {
          angular.copy($scope.tempPendingTransferShips, $scope.pendingTransferShips);
        }
        $scope.$apply();
      });
  }

  $scope.path = function(path) {
    $location.path(path);
  }

  $scope.toWei = function(ether) {
    return etherUnits.toWei(ether, "ether");
  }

  $scope.toEther = function(wei) {
    return etherUnits.toEther(wei, "wei");
  }

  $scope.wipeTx = function() {
    $scope.rawTx = '';
    $scope.loading = false;
  }

  $scope.sendTx = function() {
    $scope.constitution.sendTransaction($scope.signedTx, function(res) {
      if (res.error) {
        $scope.notifier.danger(res.error.msg);
      } else {
        console.log('SEND TX CALLBACK: ' + JSON.stringify(res.data));
        var bExStr = $scope.ajaxReq.type != nodes.nodeTypes.Custom ? "<a href='" + $scope.ajaxReq.blockExplorerTX.replace("[[txHash]]", res.txHash) + "' target='_blank' rel='noopener'> View your transaction </a>" : '';
        var contractAddr = $scope.rawTx['to'] != '' ? " & Contract Address <a href='" + ajaxReq.blockExplorerAddr.replace('[[address]]', $scope.rawTx['to']) + "' target='_blank' rel='noopener'>" + $scope.rawTx['to'] + "</a>" : '';
        $scope.notifier.success(globalFuncs.successMsgs[2] + "<br />" + res.txHash + "<br />" + bExStr + contractAddr);
        $location.path('state');
        $scope.polling = true;
        poll();
        $scope.signedTx = '';
        $scope.rawTx = '';
      }
    });
  }

  $scope.setPoolAddress = function(addr) {
    $rootScope.poolAddress = addr;
    $scope.poolAddress = $rootScope.poolAddress;
    $scope.constitution.setPoolAddress(addr);
  }

  $scope.readBalance = function() {
    if ($scope.poolAddress) {
      $scope.constitution.readBalance($scope.wallet.getAddressString(), function(res) {
        if (res.error) { $scope.notifier.danger(res.error.msg); }
        else $scope.balance = res.data;
        $scope.$apply();
      });
    }
  }
  
  $scope.readHasOwner = function(ship) {
    $scope.constitution.readHasOwner(ship, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.hasOwner = res.data;
      $scope.$apply();
    });
  }

  $scope.readIsOwner = function(ship, addr) {
    $scope.constitution.readIsOwner(ship, addr, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.isOwner = res.data;
    });
  }

  $scope.readPoolAssets = function() {
    $scope.constitution.readPoolAssets(function(res) {
      $scope.poolAssets = res.data;
      if ($scope.poolAssets.length > 0) {
        $scope.ship = $scope.poolAssets[0];
      } else {
        $scope.notifier.danger('This pool has no assets.');
      }
    });
  }

  $scope.readParent = function(ship) {
    $scope.constitution.readSponsor(ship, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.parentShip = res.data;
    });
  }

  $scope.readIsRequestingEscapeTo = function(ship, sponsor) {
    $scope.constitution.readIsRequestingEscapeTo(ship, sponsor, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.isEscape = res.data;
    });
  }

  $scope.readKey = function(ship) {
    $scope.constitution.readKeys(ship, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.key = res.data;
    });
  }

  $scope.readIsSpawnProxy = function(ship, addr) {
    $scope.constitution.readIsSpawnProxy(ship, addr, function(res) {
      if (res.error) { $scope.notifier.danger(res.error.msg); }
      else $scope.isSpawnProxy = res.data;
    });
  }
  //
  // DO: do transactions that modify the blockchain
  //
  $scope.doCreateGalaxy = function(galaxy, address) {
    $scope.loading = true;
    $scope.constitution.doCreateGalaxy(galaxy, address, txHandler);
  }

  $scope.doDeposit = function(star) {
    $scope.loading = true;
    $scope.constitution.doDeposit(star, $rootScope.poolAddress, txHandler);
  }

  $scope.doWithdraw = function(star) {
    $scope.loading = true;
    $scope.constitution.doWithdraw(star, $rootScope.poolAddress, txHandler)
  }

  $scope.doSpawn = function(ship, addr) {
    $scope.loading = true;
    $scope.constitution.doSpawn(ship, addr, txHandler);
  }

  $scope.doSetSpawnProxy = function(ship, addr) {
    $scope.loading = true;
    $scope.constitution.doSetSpawnProxy(ship, addr, txHandler);
  }

  $scope.doConfigureKeys = function(ship, encryptionKey, authenticationKey, cryptoSuiteVersion, discontinuous) {
    $scope.loading = true;
    $scope.constitution.doConfigureKeys(ship, encryptionKey, authenticationKey, cryptoSuiteVersion, discontinuous, txHandler);
  }

  $scope.doTransferShip = function(ship, addr, reset) {
    $scope.loading = true;
    $scope.constitution.doTransferShip(ship, addr, reset, txHandler);
  }

  $scope.doSetTransferProxy = function(ship, addr) {
    $scope.loading = true;
    $scope.constitution.doSetTransferProxy(ship, addr, txHandler);
  }

  $scope.doEscape = function(ship, sponsor) {
    $scope.loading = true;
    $scope.constitution.doEscape(ship, sponsor, txHandler);
  }

  $scope.doAdopt = function(sponsor, escapee) {
    $scope.loading = true;
    $scope.constitution.doAdopt(sponsor, escapee, txHandler);
  }

  $scope.doReject = function(sponsor, escapee) {
    $scope.loading = true;
    $scope.constitution.doReject(sponsor, escapee, txHandler);
  }

  $scope.doApprove = function(address, ship) {
    $scope.loading = true;
    $scope.constitution.doApprove(address, ship, txHandler);
  }

  $scope.doSafeTransferFrom = function(fromAddr, toAddr, ship) {
    $scope.loading = true;
    $scope.constitution.doSafeTransferFrom(fromAddr, toAddr, ship, txHandler);
  }

  $scope.doCastConstitutionVote = function(galaxy, addr, vote) {
    $scope.loading = true;
    $scope.constitution.doCastConstitutionVote(galaxy, addr, vote, txHandler);
  }

  $scope.doCastDocumentVote = function(galaxy, prop, vote) {
    $scope.loading = true;
    $scope.constitution.doCastDocumentVote(galaxy, prop, vote, txHandler);
  }

  var txHandler = function(res) {
    if (res.error) {
      $scope.notifier.danger(res.error.msg);
    } else {
      $scope.rawTx = res.rawTx;
      $scope.signedTx = res.signedTx;
      $scope.$apply();
    }
  }
}
module.exports = urbitCtrl;
