// ==UserScript==
// @name         YTScript_test
// @description  YouTube player enhancement
// @author       michi-at
// @version      0.1.904
// @updateURL    https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.meta.js
// @downloadURL  https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.user.js
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

    const DEBUG = true;



    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles.min.css";
    document.head.appendChild(link);



    function Log(text) {
        console.info(`${GM_info.script.name}: ${text}`);
    }

    class ComponentManager {
        constructor() {
            this.components = {};
            this.info = GM_info;
            this.config = this.LoadConfig();
            this.events = {};
        }

        LoadConfig() {
            let config = JSON.parse(GM_getValue(this.info.script.name) || "null") || {};
            return config;
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            for (const [, value] of Object.entries(this.components)) {
                value.Initialize();
            }

            return this;
        }

        AddComponent(component) {
            this.components[component.name] = component;
            this.config[component.name] = this.config[component.name] || {};
            component.LoadConfig(this.config[component.name]);
            this.WatchComponentConfig(component);

            return this;
        }

        WatchComponentConfig(component) {
            this.events[component.name] = {
                eventTarget: component,
                eventName: component.events.onConfigSave.eventName,
                eventListener: this.ComponentConfigSave.bind(this),
                useCapture: false
            }
        }

        ComponentConfigSave(event) {
            this.SaveConfig();
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
    class Slider {
        constructor(target, options) {
            this.sliderClassName = options.className;
            target.className = `${this.sliderClassName}-container`;
            this.api = document.createElement("div");
            this.api.className = this.sliderClassName;
            target.appendChild(this.api);
            $(this.api).slider(options.widjetOptions);

            this.api.children[1].setAttribute("tooltip", options.value.toString());
            $(this.api).on("slide slidechange", function (event, ui) {
                this.children[1].setAttribute("tooltip", ui.value);
            });

            this.events = {
                onFullscreenChange: {
                    eventTarget: document,
                    eventName: "fullscreenchange",
                    eventListener: this.FullscreenChange.bind(this),
                    useCapture: false
                }
            }
        }

        FullscreenChange() {
            this.api.classList.toggle(`${this.sliderClassName}-fullscreen`);
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            return this;
        }
    }
    /* End of Utils */



    /* Components */
    class Component extends EventTarget {
        constructor() {
            super();

            this.name = this.constructor.name;

            this.events = {
                onConfigSave: {
                    eventTarget: this,
                    eventName: "ConfigSaved",
                    eventListener: null,
                    useCapture: false
                },
                onLoad: {
                    eventTarget: document.documentElement,
                    eventName: "load",
                    eventListener: this.Load.bind(this),
                    useCapture: true
                },
                onListenerRemove: {
                    eventTarget: this,
                    eventName: "ListenerRemove",
                    eventListener: this.StopListening.bind(this),
                    useCapture: false
                },
                onYtNavigateStart: {
                    eventTarget: window,
                    eventName: "yt-navigate-start",
                    eventListener: this.YtNavigateStarted.bind(this),
                    useCapture: false
                },
                onYtNavigateFinish: {
                    eventTarget: window,
                    eventName: "yt-navigate-finish",
                    eventListener: this.YtNavigateFinished.bind(this),
                    useCapture: false
                }
            };
            this.status = {
                parent: this,
                _isLoaded: false
            };
            Object.defineProperty(this.status, "isLoaded", {
                get: function () {
                    return this._isLoaded;
                },
                set: function (value) {
                    if (typeof value === "boolean") {
                        this._isLoaded = value;
                        if (value) {
                            this.parent.dispatchEvent(
                                new CustomEvent(
                                    this.parent.events.onListenerRemove.eventName, {
                                        detail: this.parent.events.onLoad
                                    }
                                )
                            );
                        }
                    }
                }
            });

            this.UpdateLocation();
        }

        Load() {
            this.status.isLoaded = true;
        }

        StopListening(event) {
            let info = event.detail;
            info.eventTarget.removeEventListener(info.eventName, info.eventListener, info.useCapture);
        }

        YtNavigateStarted(event) {

        }

        YtNavigateFinished(event) {
            this.UpdateLocation();
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            return this;
        }

        UpdateLocation() {
            let videoId, playlistId, location = window.location;

            [, videoId] = /(?:\?|&)v=([a-zA-Z0-9\-\_]+)/g.exec(location.search) || [, ""];
            [, playlistId] = /(?:\?|&)list=([a-zA-Z0-9\-\_]+)/g.exec(location.search) || [, ""];

            this.location = {
                pageType: location.pathname.length === 1 ? "browse" : location.pathname.substring(1),
                url: location.pathname + location.search,
                videoId: videoId,
                playlistId: playlistId
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
            let event = new CustomEvent(this.events.onConfigSave.eventName, {
                detail: data
            });
            this.dispatchEvent(event);
        }
    }

    class UIComponent extends Component {
        constructor() {
            super();

            this.events.onUILoad = {
                eventTarget: document.documentElement,
                eventName: "load",
                eventListener: this.LoadUI.bind(this),
                useCapture: true
            };
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
                                    this.parent.events.onListenerRemove.eventName, {
                                        detail: this.parent.events.onUILoad
                                    }
                                )
                            );
                        }
                    }
                }
            });
        }

        LoadUI() {
            this.status.isUILoaded = true;
        }
    }

    class ComponentPanel extends UIComponent {
        constructor() {
            super();

            this.root = document.createElement("div");
            this.root.className = "ytscript-panel-main";

            this.openMenuButton = document.createElement("button");
            this.openMenuButton.className = "show-content";
            this.openMenuButton.innerHTML = '<i class="fa fa-angle-double-down"></i>';
            this.events.onMenuButtonClick = {
                eventTarget: this.openMenuButton,
                eventName: "click",
                eventListener: this.MenuButtonClicked.bind(this),
                useCapture: false
            }

            this.container = document.createElement("div");
            this.container.className = "ytscript-container";

            this.root.appendChild(this.container);
            this.root.appendChild(this.openMenuButton);
        }

        MenuButtonClicked(e) {
            e.preventDefault();

			if ($(this.container).hasClass("open")) {
				$(this.container).toggleClass("open");
				$(this.container).slideUp(500, "easeInBack", function() {
					$(this.openMenuButton).toggleClass("close");
				});
			}
			else {
				$(this.openMenuButton).toggleClass("close");
				$(this.container).slideDown(500, "easeOutBack", function () {
					$(this.container).toggleClass("open");
				});
			}
        }

        CreatePanelItem(componentName, titleIconHtml, contentHtml) {
            let regexp = `(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))`;
            componentName = componentName.replace(/(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))/, " $1")
                                         .replace(/(\S*)(.*\S*.*)/, '<span class="first">$1</span>$2');

            let componentMenu = document.createElement("div");
            componentMenu.className = "component-menu";

            let componentTitle = document.createElement("div");
            componentTitle.className = "component-title";
            componentTitle.insertAdjacentHTML("afterbegin", titleIconHtml);
            componentTitle.insertAdjacentHTML("beforeend", `<span>${componentName}</span>`);

            let hideContentButton = document.createElement("button");
            hideContentButton.className = "hide";
            hideContentButton.insertAdjacentHTML("afterbegin", '<i class="fa fa-minus"></i>');
            componentTitle.appendChild(hideContentButton);

            let componentContent = document.createElement("div");
            componentContent.className = "component-content";
            componentContent.insertAdjacentHTML("afterbegin", contentHtml);

            const HideContent = (e) => {
                e.preventDefault();

                $(componentContent).slideToggle(400, function () {
                    $(hideContentButton).toggleClass("open");
                });

                e.stopPropagation();
            }

            componentTitle.addEventListener("click", HideContent);
            hideContentButton.addEventListener("click", HideContent);

            componentMenu.appendChild(componentTitle);
            componentMenu.appendChild(componentContent);

            this.root.appendChild(componentMenu);
        }

        LoadUI() {
            let injectionTarget;
            if ((injectionTarget = document.querySelector("ytd-watch-flexy #player")) && !this.root.api) {
                injectionTarget.appendChild(this.root);
                this.root.api = this;
            }

            if (this.root.api) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        YtNavigateStarted(event) {}
        YtNavigateFinished(event) {}
    }

    class VolumeControl extends UIComponent {
        constructor() {
            super();
        }

        Load() {
            let videoElement;
            if ((videoElement = document.getElementsByClassName("html5-main-video")[0]) && !this.gain) {
                let audioContext = new AudioContext();
                let source = audioContext.createMediaElementSource(videoElement);
                let gainNode = audioContext.createGain();
                this.gain = gainNode.gain;

                this.UpdateLocation();

                let videoSettings = this.config.list[this.location.videoId] || {
                    volume: 1
                };
                this.gain.value = videoSettings.volume;
                gainNode.connect(audioContext.destination);
                source.connect(gainNode);
            }

            if (this.gain) {
                this.status.isLoaded = true;
                if (DEBUG) {
                    Log(`${this.name} has been loaded.`);
                }
            }
        }

        LoadUI() {
            let injectionTarget;
            if ((injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom " +
                    ".ytp-chrome-controls .ytp-left-controls")) && !this.slider) {
                let sliderContainer = document.createElement("div");

                let videoSettings = this.config.list[this.location.videoId] || {
                    volume: 1
                };

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-volume",
                    widjetOptions: {
                        min: 0,
                        max: 5,
                        value: videoSettings.volume,
                        range: "min",
                        step: 0.05,
                        slide: this.ChangeVolume.bind(this)
                    }
                }).Initialize();
                injectionTarget.appendChild(sliderContainer);
            }

            if (this.slider) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        ChangeVolume(event, ui) {
            let newList = {};
            newList[this.location.videoId] = {
                volume: ui.value
            };
            this.gain.value = ui.value;
            this.EditConfig("list", {
                ...this.config.list,
                ...newList
            });
        }

        YtNavigateStarted(event) {
            if (event.detail.pageType === "watch") {
                let videoSettings = this.config.list[event.detail.endpoint.watchEndpoint.videoId] || {
                    volume: 1
                };
                this.gain.value = videoSettings.volume;
                $(this.slider.api).slider("value", this.gain.value);
            }
        }

        LoadConfig(data) {
            super.LoadConfig(data);

            this.EditConfig("list", this.config.list || {});
        }

        ClearConfig() {
            this.config = {};
            this.EditConfig("list", {});
        }
    }

    class PlaybackControl extends UIComponent {
        constructor() {
            super();
        }

        Load() {

        }

        LoadUI() {

        }

        LoadConfig(data) {
            super.LoadConfig(data);

            this.EditConfig("list", this.config.list || {});
        }

        ClearConfig() {
            this.config = {};
            this.EditConfig("list", {})
        }
    }
    /* End of Components */



    manager.AddComponent(new ComponentPanel())
           .AddComponent(new VolumeControl())
           .Initialize();
})();