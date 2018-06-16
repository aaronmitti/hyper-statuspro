const { shell } = require('electron');
const { exec } = require('child_process');
const color = require('color');
const afterAll = require('after-all-results');
const tildify = require('tildify');
const pathShorten = require('path-shorten');
const { TouchBar } = require('electron');

exports.decorateConfig = (config) => {
    const colorForeground = color(config.foregroundColor || '#fff');
    const colorBackground = color(config.backgroundColor || '#000');
    const colors = {
        foreground: colorForeground.string(),
        background: colorBackground.lighten(0.3).string()
    };

    const configColors = Object.assign({
        black: '#000000',
        red: '#ff5c57',
        green: '#189303',
        yellow: '#ffff00',
        blue: '#005faf',
        magenta: '#cc00ff',
        cyan: '#00ffff',
        white: '#d0d0d0',
        lightBlack: '#808080',
        lightRed: '#ff0000',
        lightGreen: '#33ff00',
        lightYellow: '#ffff00',
        lightBlue: '#0066ff',
        lightMagenta: '#cc00ff',
        lightCyan: '#00ffff',
        lightWhite: '#ffffff'
    }, config.colors);

    const hyperStatusProLine = Object.assign({
        footerTransparent: true,
        dirtyColor: configColors.lightYellow,
        aheadColor: configColors.blue
    }, config.hyperStatusProLine);

    return Object.assign({}, config, {
        css: `
            ${config.css || ''}
            *[hidden] {
              display: none !important;
            }
            .terms_terms {
                margin-bottom: 30px;
            }
            .footer_footer {
                display: flex;
                justify-content: space-between;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 100;
                font-size: 12px;
                font-weight: bold;
                font-family: system-ui;
                height: 30px;
                background-color: ${colors.background};
                opacity: '1';
                cursor: default;
                -webkit-user-select: none;
                transition: opacity 250ms ease;
            }
            .footer_footer:hover {
                opacity: 1;
            }
            .footer_footer .footer_group {
                display: flex;
                color: ${colors.foreground};
                white-space: nowrap;
                margin: 0 0;
            }
            .footer_footer .group_overflow {
                overflow: hidden;
            }
            .footer_footer .component_component {
                display: flex;
                border-radius: 5px;
                margin-top: 5px;
                margin-bottom: 5px;
                margin-left: 5px;
                margin-right: 0px;
                padding-left: 5px;
                padding-right: 5px;
                padding-top: 0px;
                line-height: 20px;
                color: white !important;
            }
            .footer_footer .component_item {
                position: relative;
                padding-left: 3px;
                padding-right: 3px;
            }
            .footer_footer .component_item:first-of-type {
                margin-left: 0;
            }
            .footer_footer .component_k8s {
              background-color: #005faf;
            }
            .footer_footer .component_git {
                background-color: #189303;
            }
            .footer_footer .component_git_dirty {
                background-color: #ff5c57;
            }
            .footer_footer .component_cwd {
            }
            .footer_footer .item_clickable:hover {
                text-decoration: underline;
                cursor: pointer;
            }
            .footer_footer .item_icon:before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 14px;
                height: 100%;
                -webkit-mask-repeat: no-repeat;
                -webkit-mask-position: 0 center;
                background-color: ${colors.foreground};
            }
            .footer_footer .item_number {
                /* font-size: 10.5px;
                font-weight: 500; */
                font-size: 12px;
                font-weight: bold;
            }
            .footer_footer .item_cwd {
            }
            .notifications_view {
                bottom: 50px;
            }
        `
    });
};

let currentUid;
let pid;
let cwd;
let k8s = {
    context: '',
    namespace: '',
};
let git = {
    branch: '',
    remote: '',
    dirty: 0,
    ahead: 0
};


const k8sContext = (cb) => {
    exec(`/usr/local/bin/kubectl config view -o=jsonpath='{.current-context}'`, {}, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, stdout.trim());
    });
}

const k8sNamespace = (cb) => {
    exec(`/usr/local/bin/kubectl config view -o=jsonpath="{.contexts[?(@.name==\\"mgmt-torq-ditty\\")].context.namespace}"`, {}, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, stdout.trim());
    });
}

const k8sCheck = (cb) => {
    const next = afterAll((err, results) => {
        if (err) {
            return cb(err);
        }

        const context = results[0];
        const namespace = results[1];

        cb(null, {
            context: context,
            namespace: namespace
        });
    });

    k8sContext(next());
    k8sNamespace(next());
}

const isK8s = (cb) => {
    exec(`echo 'true'`, (err) => {
        cb(!err);
    });
}

const setK8s = () => {

    isK8s((exists) => {
        if (!exists) {
          k8s = {
            context: 'none',
            namespace: 'none'
          }

          return;
        }

        k8sCheck((err, result) => {
          if (err) {
              throw err;
          }

          k8s = {
            context: result.context,
            namespace: result.namespace
          }

          window.rpc.emit('statuspro-update', {k8s: k8s, git: git, cwd: cwd});
        })
    });
}

const setCwd = (pid, action) => {
    if (process.platform == 'win32') {
        let directoryRegex = /([a-zA-Z]:[^\:\[\]\?\"\<\>\|]+)/mi;
        if (action && action.data) {
            let path = directoryRegex.exec(action.data);
            if(path){
                cwd = path[0];
                window.rpc.emit('statuspro-update', {k8s: k8s, git: git, cwd: cwd});

                setGit(cwd);
                setK8s();
            }
        }
    } else {
        exec(`lsof -p ${pid} | awk '$4=="cwd"' | tr -s ' ' | cut -d ' ' -f9-`, (err, stdout) => {
            cwd = stdout.trim();
            window.rpc.emit('statuspro-update', {k8s: k8s, git: git, cwd: cwd});

            setGit(cwd);
            setK8s();
        });
    }
};

const isGit = (dir, cb) => {
    exec(`git rev-parse --is-inside-work-tree`, { cwd: dir }, (err) => {
        cb(!err);
    });
}

const gitBranch = (repo, cb) => {
    exec(`git symbolic-ref --short HEAD || git rev-parse --short HEAD`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, stdout.trim());
    });
}

const gitRemote = (repo, cb) => {
    exec(`git ls-remote --get-url`, { cwd: repo }, (err, stdout) => {
        cb(null, stdout.trim().replace(/^git@(.*?):/, 'https://$1/').replace(/[A-z0-9\-]+@/, '').replace(/\.git$/, ''));
    });
}

const gitDirty = (repo, cb) => {
    exec(`git status --porcelain --ignore-submodules -uno`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, !stdout ? 0 : parseInt(stdout.trim().split('\n').length, 10));
    });
}

const gitAhead = (repo, cb) => {
    exec(`git rev-list --left-only --count HEAD...@'{u}' 2>/dev/null`, { cwd: repo }, (err, stdout) => {
        cb(null, parseInt(stdout, 10));
    });
}

const gitCheck = (repo, cb) => {
    const next = afterAll((err, results) => {
        if (err) {
            return cb(err);
        }

        const branch = results[0];
        const remote = results[1];
        const dirty = results[2];
        const ahead = results[3];

        cb(null, {
            branch: branch,
            remote: remote,
            dirty: dirty,
            ahead: ahead
        });
    });

    gitBranch(repo, next());
    gitRemote(repo, next());
    gitDirty(repo, next());
    gitAhead(repo, next());
}

const setGit = (repo) => {
    isGit(repo, (exists) => {
        if (!exists) {
            git = {
                branch: '',
                remote: '',
                dirty: 0,
                ahead: 0
            }

            return;
        }

        gitCheck(repo, (err, result) => {
            if (err) {
                throw err;
            }

            git = {
                branch: result.branch,
                remote: result.remote,
                dirty: result.dirty,
                ahead: result.ahead
            }

            window.rpc.emit('statuspro-update', {cwd: cwd, git: git});
        })
    });
}

exports.decorateHyper = (Hyper, { React }) => {
    return class extends React.PureComponent {
        constructor(props) {
            super(props);

            this.state = {
                cwd: '',
                branch: '',
                remote: '',
                dirty: 0,
                ahead: 0,
                context: '',
                namespace: ''
            }

            this.handleCwdClick = this.handleCwdClick.bind(this);
            this.handleBranchClick = this.handleBranchClick.bind(this);
        }

        handleCwdClick(event) {
            shell.openExternal('file://'+this.state.cwd);
        }

        handleBranchClick(event) {
            shell.openExternal(this.state.remote);
        }

        render() {
            const { customChildren } = this.props
            const existingChildren = customChildren ? customChildren instanceof Array ? customChildren : [customChildren] : [];

            return (
                React.createElement(Hyper, Object.assign({}, this.props, {
                    customInnerChildren: existingChildren.concat(React.createElement('footer', { className: 'footer_footer' },
                        React.createElement('div', { className: 'footer_group group_overflow' },
                            React.createElement('div', { className: 'component_component component_k8s' },
                                React.createElement('div', { className: 'component_item item_k8s item_clickable', title: this.state.context, onClick: this.handleK8sClick, hidden: !this.state.context }, "⎈ " + this.state.context + ":" + this.state.namespace)
                            ),
                            React.createElement('div', { className: `component_component component_git ${this.state.dirty ? 'component_git_dirty' : ''}`, hidden: !this.state.branch },
                                React.createElement('div', { className: `component_item item_branch ${this.state.remote ? 'item_clickable' : ''}`, title: this.state.remote, onClick: this.handleBranchClick }, "⎇ " + this.state.branch),
                                React.createElement('div', { className: 'component_item item_number item_dirty', title: `${this.state.dirty} dirty ${this.state.dirty > 1 ? 'files' : 'file'}`, hidden: !this.state.dirty }, " ✎"),
                                React.createElement('div', { className: 'component_item item_number item_ahead', title: `${this.state.ahead} ${this.state.ahead > 1 ? 'commits' : 'commit'} ahead`, hidden: !this.state.ahead }, " ⇧")
                            ),
                            React.createElement('div', { className: 'component_component component_cwd' },
                                React.createElement('div', { className: 'component_item item_cwd item_clickable', title: this.state.cwd, onClick: this.handleCwdClick, hidden: !this.state.cwd }, this.state.cwd ? tildify(String(this.state.cwd)) : '')
                            )
                        ),
                        React.createElement('div', { className: 'footer_group' },
                            React.createElement('div', { className: 'component_component component_datetime' },
                                React.createElement('div', { className: 'component_item item_datetime' },
                                  this.now
                                )
                            )
                        )
                    ))
                }))
            );
        }

        componentDidMount() {
            this.interval = setInterval(() => {
                this.setState({
                    cwd: cwd,
                    branch: git.branch,
                    remote: git.remote,
                    dirty: git.dirty,
                    ahead: git.ahead,
                    context: k8s.context,
                    namespace: k8s.namespace,
                    now: new Date()
                });
            }, 100);
        }

        componentWillUnmount() {
            clearInterval(this.interval);
        }
    };
};

exports.middleware = (store) => (next) => (action) => {
    const uids = store.getState().sessions.sessions;

    switch (action.type) {

        case 'SESSION_SET_XTERM_TITLE':
            pid = uids[action.uid].pid;
            break;

        case 'SESSION_ADD':
            pid = action.pid;
            setCwd(pid);
            break;

        case 'SESSION_ADD_DATA':
            const { data } = action;
            const enterKey = data.indexOf('\n') > 0;

            if (enterKey) {
                setCwd(pid, action);
            }
            break;

        case 'SESSION_SET_ACTIVE':
            pid = uids[action.uid].pid;
            setCwd(pid);
            break;

    }

    next(action);
};

exports.onWindow = win => {
  const {TouchBarButton, TouchBarLabel, TouchBarSpacer} = TouchBar

  const k8sTouchBarButton = new TouchBarButton({
    label: "",
    backgroundColor: '#000000'
  });

  const cwdTouchBarLabel = new TouchBarLabel({
    textColor: '#ffffff'
  });

  const gitTouchBarButton = new TouchBarButton({
    label: "",
    backgroundColor: "#000000"
  });

  const k8sTouchBar = new TouchBar([
      k8sTouchBarButton,
      gitTouchBarButton,
      cwdTouchBarLabel
  ]);

  const updateTouchBar = ({k8s: k8s, git: git, cwd: cwd}) => {
    // Update Kubernetes Status
    if (k8s.context) {
      k8sTouchBarButton.backgroundColor = "#005faf";
      k8sTouchBarButton.label = "⎈ " + k8s.context + ":" + k8s.namespace;
      k8sTouchBarButton.click = () => {
        shell.openExternal("http://" + k8s.context + "/kubernetes/");
      }
    } else {
      k8sTouchBarButton.backgroundColor = "#222222";
      k8sTouchBarButton.label = "⎈ not initialized";
      k8sTouchBarButton.click = ""
    }

    // Update Git Status
    if (git.branch) {
      git_label = "⎇ " + git.branch;

      if (git.dirty) {
        git_label = git_label + " ✎";
        git_color = "#ff5c57";
      } else {
        git_color = "#189303";
      }

      if (git.ahead) {
        git_label = git_label + " ⇧" + git.ahead;
      }

      gitTouchBarButton.click = () => {
        shell.openExternal(git.remote);
      }
    } else {
    var git_label = "⎇ not initialized";
    var git_color = "#222222";
    }
    gitTouchBarButton.label = git_label;
    gitTouchBarButton.backgroundColor = git_color;

    // Update current working directory
    cwdTouchBarLabel.label = pathShorten(String(cwd), {length: 1});

    k8sTouchBar
  };

  win.setTouchBar(k8sTouchBar);

  win.rpc.on('statuspro-update', ({k8s: k8s, git: git, cwd: cwd}) => {
    new Promise((resolve, reject) => {
      updateTouchBar({k8s: k8s, git: git, cwd: cwd});
      resolve();
    });
  });
};
