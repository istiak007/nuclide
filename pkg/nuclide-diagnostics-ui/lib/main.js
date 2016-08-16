Object.defineProperty(exports, '__esModule', {
  value: true
});

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

exports.activate = activate;
exports.consumeDiagnosticUpdates = consumeDiagnosticUpdates;
exports.consumeStatusBar = consumeStatusBar;
exports.consumeToolBar = consumeToolBar;
exports.deactivate = deactivate;
exports.serialize = serialize;
exports.getHomeFragments = getHomeFragments;
exports.getDistractionFreeModeProvider = getDistractionFreeModeProvider;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _assert2;

function _assert() {
  return _assert2 = _interopRequireDefault(require('assert'));
}

var _atom2;

function _atom() {
  return _atom2 = require('atom');
}

var _nuclideAnalytics2;

function _nuclideAnalytics() {
  return _nuclideAnalytics2 = require('../../nuclide-analytics');
}

var _commonsNodeStream2;

function _commonsNodeStream() {
  return _commonsNodeStream2 = require('../../commons-node/stream');
}

var _createPanel2;

function _createPanel() {
  return _createPanel2 = _interopRequireDefault(require('./createPanel'));
}

var _StatusBarTile2;

function _StatusBarTile() {
  return _StatusBarTile2 = _interopRequireDefault(require('./StatusBarTile'));
}

var _gutter2;

function _gutter() {
  return _gutter2 = require('./gutter');
}

var DEFAULT_HIDE_DIAGNOSTICS_PANEL = true;
var DEFAULT_TABLE_HEIGHT = 200;
var DEFAULT_FILTER_BY_ACTIVE_EDITOR = false;
var LINTER_PACKAGE = 'linter';

var subscriptions = null;
var bottomPanel = null;
var statusBarTile = undefined;

var activationState = null;

var consumeUpdatesCalled = false;

function createPanel(diagnosticUpdater) {
  (0, (_assert2 || _assert()).default)(activationState);

  var _ref = (0, (_createPanel2 || _createPanel()).default)(diagnosticUpdater.allMessageUpdates, activationState.diagnosticsPanelHeight, activationState.filterByActiveTextEditor, disableLinter, function (filterByActiveTextEditor) {
    if (activationState != null) {
      activationState.filterByActiveTextEditor = filterByActiveTextEditor;
    }
  });

  var panel = _ref.atomPanel;
  var setWarnAboutLinter = _ref.setWarnAboutLinter;

  logPanelIsDisplayed();
  bottomPanel = panel;

  return new (_atom2 || _atom()).CompositeDisposable(panel.onDidChangeVisible(function (visible) {
    (0, (_assert2 || _assert()).default)(activationState);
    activationState.hideDiagnosticsPanel = !visible;
  }), watchForLinter(setWarnAboutLinter));
}

function disableLinter() {
  atom.packages.disablePackage(LINTER_PACKAGE);
}

function watchForLinter(setWarnAboutLinter) {
  if (atom.packages.isPackageActive(LINTER_PACKAGE)) {
    setWarnAboutLinter(true);
  }
  return new (_atom2 || _atom()).CompositeDisposable(atom.packages.onDidActivatePackage(function (pkg) {
    if (pkg.name === LINTER_PACKAGE) {
      setWarnAboutLinter(true);
    }
  }), atom.packages.onDidDeactivatePackage(function (pkg) {
    if (pkg.name === LINTER_PACKAGE) {
      setWarnAboutLinter(false);
    }
  }));
}

function getStatusBarTile() {
  if (!statusBarTile) {
    statusBarTile = new (_StatusBarTile2 || _StatusBarTile()).default();
  }
  return statusBarTile;
}

function tryRecordActivationState() {
  (0, (_assert2 || _assert()).default)(activationState);
  if (bottomPanel && bottomPanel.isVisible()) {
    activationState.diagnosticsPanelHeight = bottomPanel.getItem().clientHeight;
  }
}

function activate(state_) {
  var state = state_;
  if (subscriptions) {
    return;
  }
  subscriptions = new (_atom2 || _atom()).CompositeDisposable();

  // Ensure the integrity of the ActivationState created from state.
  if (!state) {
    state = {};
  }
  if (typeof state.hideDiagnosticsPanel !== 'boolean') {
    state.hideDiagnosticsPanel = DEFAULT_HIDE_DIAGNOSTICS_PANEL;
  }
  if (typeof state.diagnosticsPanelHeight !== 'number') {
    state.diagnosticsPanelHeight = DEFAULT_TABLE_HEIGHT;
  }
  if (typeof state.filterByActiveTextEditor !== 'boolean') {
    state.filterByActiveTextEditor = DEFAULT_FILTER_BY_ACTIVE_EDITOR;
  }
  activationState = state;
}

function consumeDiagnosticUpdates(diagnosticUpdater) {
  getStatusBarTile().consumeDiagnosticUpdates(diagnosticUpdater);
  gutterConsumeDiagnosticUpdates(diagnosticUpdater);

  // Currently, the DiagnosticsPanel is designed to work with only one DiagnosticUpdater.
  if (consumeUpdatesCalled) {
    return;
  }
  consumeUpdatesCalled = true;

  tableConsumeDiagnosticUpdates(diagnosticUpdater);
  addAtomCommands(diagnosticUpdater);
}

function gutterConsumeDiagnosticUpdates(diagnosticUpdater) {
  var fixer = diagnosticUpdater.applyFix.bind(diagnosticUpdater);

  (0, (_assert2 || _assert()).default)(subscriptions != null);
  subscriptions.add(atom.workspace.observeTextEditors(function (editor) {
    var filePath = editor.getPath();
    if (!filePath) {
      return; // The file is likely untitled.
    }

    var callback = function callback(update) {
      (0, (_gutter2 || _gutter()).applyUpdateToEditor)(editor, update, fixer);
    };
    var disposable = new (_commonsNodeStream2 || _commonsNodeStream()).DisposableSubscription(diagnosticUpdater.getFileMessageUpdates(filePath).subscribe(callback));

    // Be sure to remove the subscription on the DiagnosticStore once the editor is closed.
    editor.onDidDestroy(function () {
      return disposable.dispose();
    });
  }));
}

function tableConsumeDiagnosticUpdates(diagnosticUpdater) {
  (0, (_assert2 || _assert()).default)(subscriptions != null);

  var toggleTable = function toggleTable() {
    var bottomPanelRef = bottomPanel;
    if (bottomPanelRef == null) {
      (0, (_assert2 || _assert()).default)(subscriptions != null);
      subscriptions.add(createPanel(diagnosticUpdater));
    } else if (bottomPanelRef.isVisible()) {
      tryRecordActivationState();
      bottomPanelRef.hide();
    } else {
      logPanelIsDisplayed();
      bottomPanelRef.show();
    }
  };

  var showTable = function showTable() {
    if (bottomPanel == null || !bottomPanel.isVisible()) {
      toggleTable();
    }
  };

  subscriptions.add(atom.commands.add(atom.views.getView(atom.workspace), 'nuclide-diagnostics-ui:toggle-table', toggleTable));

  subscriptions.add(atom.commands.add(atom.views.getView(atom.workspace), 'nuclide-diagnostics-ui:show-table', showTable));

  (0, (_assert2 || _assert()).default)(activationState);
  if (!activationState.hideDiagnosticsPanel) {
    (0, (_assert2 || _assert()).default)(subscriptions != null);
    subscriptions.add(createPanel(diagnosticUpdater));
  }
}

function addAtomCommands(diagnosticUpdater) {
  var fixAllInCurrentFile = function fixAllInCurrentFile() {
    var editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      return;
    }
    var path = editor.getPath();
    if (path == null) {
      return;
    }
    (0, (_nuclideAnalytics2 || _nuclideAnalytics()).track)('diagnostics-autofix-all-in-file');
    diagnosticUpdater.applyFixesForFile(path);
  };

  (0, (_assert2 || _assert()).default)(subscriptions != null);

  subscriptions.add(atom.commands.add(atom.views.getView(atom.workspace), 'nuclide-diagnostics-ui:fix-all-in-current-file', fixAllInCurrentFile));
}

function consumeStatusBar(statusBar) {
  getStatusBarTile().consumeStatusBar(statusBar);
}

function consumeToolBar(getToolBar) {
  var toolBar = getToolBar('nuclide-diagnostics-ui');
  toolBar.addButton({
    icon: 'law',
    callback: 'nuclide-diagnostics-ui:toggle-table',
    tooltip: 'Toggle Diagnostics Table',
    priority: 200
  });
  var disposable = new (_atom2 || _atom()).Disposable(function () {
    toolBar.removeItems();
  });
  (0, (_assert2 || _assert()).default)(subscriptions != null);
  subscriptions.add(disposable);
  return disposable;
}

function deactivate() {
  if (subscriptions) {
    subscriptions.dispose();
    subscriptions = null;
  }

  if (bottomPanel) {
    bottomPanel.destroy();
    bottomPanel = null;
  }

  if (statusBarTile) {
    statusBarTile.dispose();
    statusBarTile = null;
  }

  consumeUpdatesCalled = false;
}

function serialize() {
  tryRecordActivationState();
  (0, (_assert2 || _assert()).default)(activationState);
  return activationState;
}

function getHomeFragments() {
  return {
    feature: {
      title: 'Diagnostics',
      icon: 'law',
      description: 'Displays diagnostics, errors, and lint warnings for your files and projects.',
      command: 'nuclide-diagnostics-ui:show-table'
    },
    priority: 4
  };
}

function getDistractionFreeModeProvider() {
  return {
    name: 'nuclide-diagnostics-ui',
    isVisible: function isVisible() {
      return bottomPanel != null && bottomPanel.isVisible();
    },
    toggle: function toggle() {
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'nuclide-diagnostics-ui:toggle-table');
    }
  };
}

function logPanelIsDisplayed() {
  (0, (_nuclideAnalytics2 || _nuclideAnalytics()).track)('diagnostics-show-table');
}