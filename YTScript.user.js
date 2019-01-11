    // ==UserScript==
    // @name         YTScript
    // @description  YouTube player enhancement
    // @author       michi-at
    // @version      0.0.1
    // @updateURL    https://github.com/michi-at/YTScript/raw/master/YTScript.meta.js
    // @downloadURL  https://github.com/michi-at/YTScript/raw/master/YTScript.user.js
    // @match        *://www.youtube.com/*
    // @exclude      *://www.youtube.com/embed/*
    // @grant        GM_getValue
    // @grant        GM_setValue
    // @grant        GM_deleteValue
    // @run-at       document-start
    // ==/UserScript==

    (function () {
        "use strict";

        let styles = document.createElement("link");
        styles.rel = "stylesheet";
        styles.href = "https://gist.github.com/michi-at/3fbee92a72756e170a2d86c2fa5f88da/raw/YTStyles.min.css"
        document.head.appendChild(styles);

        class ComponentManager {
            constructor() {
                this.components = {};
                this.info = GM_info;
                this.config = this.LoadConfig();
            }

            Initialize() {

            }

            AddComponent(component) {
                this.components[component.name] = component;
                this.config[component.name] = this.config[component.name] || {};
                component.LoadConfig(this.config[component.name]);
                component.addEventListener(component.events.onConfigSave, this.OnComponentConfigSave);
            }

            OnComponentConfigSave(event) {
                this.SaveConfig();
            }

            LoadConfig() {
                let config = JSON.parse(GM_getValue(this.info.script.name) || "null") || {};
                return config;
            }

            EditConfig(componentName, value) {
                this.config[componentName] = value;
                this.SaveConfig();
            }

            SaveConfig() {
                let configString = JSON.stringify(this.config);
                GM_setValue(this.info.script.name, configString);
            }
        }
        const manager = new ComponentManager();

        /* Utils-misc */
        class Slider {

        }
        /* End of Utils-misc */

        /* Components */
        class Component extends EventTarget {
            constructor() {
                super();

                this.name = this.constructor.name;
                this.events = {
                    onConfigSave: "ConfigSaved"
                };
                this.eventListeners = {};
            }

            LoadConfig(data) {
                this.config = data;
            }

            EditConfig(key, value) {
                let oldValue = this.config[key];
                this.config[key] = value;
                this.SaveConfig(key, oldValue, value);
            }

            SaveConfig(key, oldValue, newValue) {
                let data = {
                    name: this.name,
                    key: key,
                    oldValue: oldValue,
                    newValue: newValue
                }
                let event = new CustomEvent(this.events.onConfigSave, { detail: data })
                this.dispatchEvent(event);
            }
        }

        class UIComponent extends Component {
            constructor() {
                super();

                this.eventListeners.LoadListener = this.InitializeUI.bind(this);
                document.documentElement.addEventListener("load", this.eventListeners.LoadListener, true);
            }

            // in derived classes always call super.InitializeUI() at the end 
            InitializeUI() {
                document.documentElement.removeEventListener("load", this.eventListeners.LoadListener, true);
            }
        }

        class VolumeControl extends UIComponent {
            constructor() {
                super();
            }

            InitializeUI() {
                let injectionTarget;
                if ((injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom "
                                                            + ".ytp-chrome-controls .ytp-left-controls")))
                {
                    let slider = document.createElement("input");
                    slider.type = "range";
                    slider.className = "ytscript-slider";
                    slider.min = "0";
                    slider.max = "10";
                    injectionTarget.appendChild(slider);

                    super.InitializeUI();
                }
            }
        }
        /* End of Components */

        manager.AddComponent(new VolumeControl());

        manager.Initialize();
    })();