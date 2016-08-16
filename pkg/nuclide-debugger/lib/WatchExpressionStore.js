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

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _atom2;

function _atom() {
  return _atom2 = require('atom');
}

var _DebuggerStore2;

function _DebuggerStore() {
  return _DebuggerStore2 = require('./DebuggerStore');
}

var _Constants2;

function _Constants() {
  return _Constants2 = require('./Constants');
}

var _rxjsBundlesRxUmdMinJs2;

function _rxjsBundlesRxUmdMinJs() {
  return _rxjsBundlesRxUmdMinJs2 = _interopRequireDefault(require('rxjs/bundles/Rx.umd.min.js'));
}

var _assert2;

function _assert() {
  return _assert2 = _interopRequireDefault(require('assert'));
}

var _commonsNodeStream2;

function _commonsNodeStream() {
  return _commonsNodeStream2 = require('../../commons-node/stream');
}

var WatchExpressionStore = (function () {
  function WatchExpressionStore(dispatcher, bridge) {
    var _this = this;

    _classCallCheck(this, WatchExpressionStore);

    this._bridge = bridge;
    this._disposables = new (_atom2 || _atom()).CompositeDisposable();
    this._watchExpressions = new Map();
    this._disposables.add(new (_atom2 || _atom()).Disposable(function () {
      return _this._watchExpressions.clear();
    }));
    // `this._previousEvaluationSubscriptions` can change at any time and are a distinct subset of
    // `this._disposables`.
    this._previousEvaluationSubscriptions = new (_atom2 || _atom()).CompositeDisposable();
    this._disposables.add(this._previousEvaluationSubscriptions);
    var _dispatcherToken = dispatcher.register(this._handlePayload.bind(this));
    this._disposables.add(new (_atom2 || _atom()).Disposable(function () {
      dispatcher.unregister(_dispatcherToken);
    }));
  }

  _createClass(WatchExpressionStore, [{
    key: '_handlePayload',
    value: function _handlePayload(payload) {
      switch (payload.actionType) {
        case (_Constants2 || _Constants()).Actions.CLEAR_INTERFACE:
          this._clearEvaluationValues();
          break;
        case (_Constants2 || _Constants()).Actions.DEBUGGER_MODE_CHANGE:
          if (payload.data === (_DebuggerStore2 || _DebuggerStore()).DebuggerMode.PAUSED) {
            this._triggerReevaluation();
          } else if (payload.data === (_DebuggerStore2 || _DebuggerStore()).DebuggerMode.STOPPED) {
            this._cancelRequestsToBridge();
            this._clearEvaluationValues();
          }
          break;
        default:
          return;
      }
    }
  }, {
    key: '_requestActionFromBridge',
    value: function _requestActionFromBridge(subject, callback) {
      return new (_commonsNodeStream2 || _commonsNodeStream()).DisposableSubscription((_rxjsBundlesRxUmdMinJs2 || _rxjsBundlesRxUmdMinJs()).default.Observable.fromPromise(callback()).merge((_rxjsBundlesRxUmdMinJs2 || _rxjsBundlesRxUmdMinJs()).default.Observable.never()).subscribe(subject));
    }
  }, {
    key: '_requestExpressionEvaluation',
    value: function _requestExpressionEvaluation(expression, subject, supportRepl) {
      var _this2 = this;

      var evaluationDisposable = this._requestActionFromBridge(subject, function () {
        return supportRepl ? _this2._bridge.evaluateConsoleExpression(expression) : _this2._bridge.evaluateWatchExpression(expression);
      });
      // Non-REPL environments will want to record these requests so they can be canceled on
      // re-evaluation, e.g. in the case of stepping.  REPL environments should let them complete so
      // we can have e.g. a history of evaluations in the console.
      if (!supportRepl) {
        this._previousEvaluationSubscriptions.add(evaluationDisposable);
      }
    }

    /**
     * Returns an observable of child properties for the given objectId.
     * Resources are automatically cleaned up once all subscribers of an expression have unsubscribed.
     */
  }, {
    key: 'getProperties',
    value: function getProperties(objectId) {
      return (_rxjsBundlesRxUmdMinJs2 || _rxjsBundlesRxUmdMinJs()).default.Observable.fromPromise(this._bridge.getProperties(objectId));
    }
  }, {
    key: 'evaluateConsoleExpression',
    value: function evaluateConsoleExpression(expression) {
      return this._evaluateExpression(expression, true /* support REPL */);
    }
  }, {
    key: 'evaluateWatchExpression',
    value: function evaluateWatchExpression(expression) {
      return this._evaluateExpression(expression, false /* do not support REPL */);
    }

    /**
     * Returns an observable of evaluation results for a given expression.
     * Resources are automatically cleaned up once all subscribers of an expression have unsubscribed.
     *
     * The supportRepl boolean indicates if we allow evaluation in a non-paused state.
     */
  }, {
    key: '_evaluateExpression',
    value: function _evaluateExpression(expression, supportRepl) {
      if (!supportRepl && this._watchExpressions.has(expression)) {
        var cachedResult = this._watchExpressions.get(expression);
        (0, (_assert2 || _assert()).default)(cachedResult);
        return cachedResult;
      }
      var subject = new (_rxjsBundlesRxUmdMinJs2 || _rxjsBundlesRxUmdMinJs()).default.BehaviorSubject();
      this._requestExpressionEvaluation(expression, subject, supportRepl);
      if (!supportRepl) {
        this._watchExpressions.set(expression, subject);
      }
      // Expose an observable rather than the raw subject.
      return subject.asObservable();
    }
  }, {
    key: '_triggerReevaluation',
    value: function _triggerReevaluation() {
      this._cancelRequestsToBridge();
      for (var _ref3 of this._watchExpressions) {
        var _ref2 = _slicedToArray(_ref3, 2);

        var expression = _ref2[0];
        var subject = _ref2[1];

        if (subject.observers == null || subject.observers.length === 0) {
          // Nobody is watching this expression anymore.
          this._watchExpressions.delete(expression);
          continue;
        }
        this._requestExpressionEvaluation(expression, subject, false /* no REPL support */);
      }
    }
  }, {
    key: '_cancelRequestsToBridge',
    value: function _cancelRequestsToBridge() {
      this._previousEvaluationSubscriptions.dispose();
      this._previousEvaluationSubscriptions = new (_atom2 || _atom()).CompositeDisposable();
    }

    // Resets all values to N/A, for examples when the debugger resumes or stops.
  }, {
    key: '_clearEvaluationValues',
    value: function _clearEvaluationValues() {
      for (var subject of this._watchExpressions.values()) {
        subject.next(null);
      }
    }
  }, {
    key: 'dispose',
    value: function dispose() {
      this._disposables.dispose();
    }
  }]);

  return WatchExpressionStore;
})();

exports.WatchExpressionStore = WatchExpressionStore;