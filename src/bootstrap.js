  Object.assign(BilliardsGame.prototype, storageMethods, inputMethods, aiMethods, rulesMethods, physicsMethods, renderMethods);

  function injectStyles() {
    const tag = 'dsh-billiards/style.css';
    let el = document.querySelector(`style[data-plugin-css="${tag}"]`);
    if (!el) {
      el = document.createElement('style');
      el.dataset.plugin = PLUGIN_ID;
      el.dataset.pluginCss = tag;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    el.dataset.users = String(Number(el.dataset.users || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const users = Number(el.dataset.users) - 1;
      el.dataset.users = String(users);
      if (users <= 0) el.remove();
    };
  }

  function apply(ctx) {
    ctx.effect(() => injectStyles(), 'dsh-billiards: styles');
    ctx.slots.inject('shell.overlay', function* () {
      yield ctx.slots.register(
        { name: 'shell.overlay', id: 'billiards', order: 900 },
        function BilliardsOverlay() {
          const ref = React.useRef(null);
          React.useEffect(() => {
            if (!ref.current) return undefined;
            const game = new BilliardsGame(ref.current);
            return () => game.destroy();
          }, []);
          return React.createElement('div', { ref, className: 'dsh-bil-host' });
        },
      );
    });
  }

  // React is seeded by the DSH shell and fetched inside the factory.
  let React;
  if (window.__DSH_BILLIARDS_TEST__ === true) {
    window.__DSH_BILLIARDS_TEST_API__ = { BilliardsGame, SoundKit, loadPrefs };
  } else if (window.__DSH_BILLIARDS_PREVIEW__ === true) {
    // Local visual harness: mount the same game against a mock Harness page
    // without needing the Cordis loader. Never reached inside DSH.
    injectStyles();
    const host = document.createElement('div');
    host.className = 'dsh-bil-host';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    const game = new BilliardsGame(host);
    window.__BILLIARDS_PREVIEW_GAME__ = game;
    game.open();
  } else {
    window.__ModuleLoader__.load({
      id: PLUGIN_ID,
      factory: (require) => {
        React = require('react');
        return { name: 'billiards', inject: ['slots'], apply };
      },
    });
  }
