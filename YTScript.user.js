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
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// ==/UserScript==

(function () {
    "use strict";

    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles.min.css";
    document.head.appendChild(link);



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



    /* Utils */
    const Utils = {
        MergeDeep: function (...objects) {
            const isObject = obj => obj && typeof obj === 'object';

            return objects.reduce((prev, obj) => {
                Object.keys(obj).forEach(key => {
                    const pVal = prev[key];
                    const oVal = obj[key];

                    if (Array.isArray(pVal) && Array.isArray(oVal)) {
                        prev[key] = pVal.concat(...oVal);
                    } else if (isObject(pVal) && isObject(oVal)) {
                        prev[key] = this.MergeDeep(pVal, oVal);
                    } else {
                        prev[key] = oVal;
                    }
                });

                return prev;
            }, {});
        }
    }
    /* End of Utils */



    /* Components */
    class Component extends EventTarget {
        constructor() {
            super();

            this.name = this.constructor.name;
            this.events = {
                onConfigSave: "ConfigSaved",
                onLoad: "load"
            };
            this.eventListeners = {};
            this.status = {
                parent: this
            };
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
            let event = new CustomEvent(this.events.onConfigSave, {
                detail: data
            })
            this.dispatchEvent(event);
        }
    }

    class UIComponent extends Component {
        constructor() {
            super();

            this.events.onListenerRemove = "ListenerRemove";

            this.status._isUILoaded = false;
            Object.defineProperty(this.status, "isUILoaded", {
                get: function () {
                    return this._isUILoaded;
                },
                set: function (value) {
                    if (typeof value === "boolean") {
                        this._isUILoaded = value;
                        if (value) {
                            this.parent.dispatchEvent(
                                new CustomEvent(
                                    this.parent.events.onListenerRemove, {
                                        detail: this.parent.events.onLoad
                                    }
                                )
                            );
                        }
                    }
                }
            });

            this.eventListeners.LoadListener = this.InitializeUI.bind(this);
            this.eventListeners.RemoveListener = this.StopListening.bind(this);
            document.documentElement.addEventListener(this.events.onLoad, this.eventListeners.LoadListener, true);
            this.addEventListener(this.events.onListenerRemove, this.eventListeners.RemoveListener);
        }

        InitializeUI() {

        }

        StopListening(event) {
            if (event.detail === this.events.onLoad) {
                document.documentElement.removeEventListener(this.events.onLoad, this.eventListeners.LoadListener, true);
            }
        }
    }

    class VolumeControl extends UIComponent {
        constructor() {
            super();
        }

        InitializeUI() {
            let injectionTarget;
            if ((injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom " +
                    ".ytp-chrome-controls .ytp-left-controls"))) {

                let sliderContainer = document.createElement("div");
                sliderContainer.className = "ytscript-slider-container";
                let slider = document.createElement("div");
                slider.className = "ytscript-slider";
                sliderContainer.appendChild(slider);
                $(slider).slider({
                    min: 0,
                    max: 7,
                    value: 1,
                    range: "min",
                    step: 0.05,
                    slide: function(event, ui) {
                        console.log(ui.value);
                    }
                });
                injectionTarget.appendChild(sliderContainer);

                this.status.isUILoaded = true;
            }
        }
    }
    /* End of Components */



    manager.AddComponent(new VolumeControl());

    manager.Initialize();
})();