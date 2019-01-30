// ==UserScript==
// @name         YTScript_test
// @description  YouTube player enhancement
// @author       michi-at
// @version      0.2.105
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

    const DEBUG = false;



    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles_test.min.css";
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
            this.config[event.target.name] = event.detail;
            this.components[event.target.name].LoadConfig(this.config[event.target.name]);
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

            this.SetTooltip(options.widjetOptions);

            this.events = {
                onFullscreenChange: {
                    eventTarget: document,
                    eventName: "fullscreenchange",
                    eventListener: this.FullscreenChange.bind(this),
                    useCapture: false
                }
            }
        }

        SetTooltip({ value, values, range } = options) {
            if (range === "min") {
                this.api.children[1].setAttribute("tooltip", value || "");
                $(this.api).on("slide slidechange", function (event, ui) {
                    this.children[1].setAttribute("tooltip", ui.value);
                });
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

    const Utils = {
        Animate: function ({ duration, timing, draw, complete }) {

            let start = performance.now();

            requestAnimationFrame(function animate(time) {
                let timeFraction = (time - start) / duration;
                if (timeFraction > 1) timeFraction = 1;
                if (timeFraction < 0) timeFraction = 0;

                let progress = timing(timeFraction);

                ((progress, complete) => {
                    draw(progress);
                    
                    if (progress === 1) {
                        complete();
                    }
                })(progress, complete);

                if (timeFraction < 1) {
                    requestAnimationFrame(animate);
                }
            });
        },
        LinearInterpolation: function (x1, y1, x2, y2) {
            let a = (y1 - y2) / (x1 - x2);
            let b = (x1 * y2 - x2 * y1) / (x1 - x2);
            return function (x) {
                return a * x + b;
            }
        },
        Ease: function (t) {
            return t * t / (2.0 * (t * t - t) + 1.0);
        },
        EaseDown: function (t) {
            return t * (3.54 - 3.42 * t + 0.88 * t * t);
        },
        EaseUp: function (t) {
            return t * t * (3 * t - 2);
        },
        SecondsToTimeString: function (seconds) {
            let hours = Math.floor(seconds / 3600);
            seconds -= hours * 3600;
            let minutes = Math.floor(seconds / 60);
            seconds -= minutes * 60;
            let milliseconds = Math.round((seconds % 1) * 1000);
            if (milliseconds === 1000) {
                milliseconds = 0;
                seconds = Math.round(seconds);
            }
            else {
                seconds = Math.floor(seconds);
            }	
    
            if (hours < 10) { hours = "0" + hours; }
            if (minutes < 10) { minutes = "0" + minutes; }
            if (seconds < 10) { seconds = "0" + seconds; }
            if (milliseconds < 100) { milliseconds = "0" + milliseconds; }
            if (milliseconds < 10) { milliseconds = "0" + milliseconds; }
            return hours > 0 ? hours + ":" + minutes + ":" + seconds + "." + milliseconds
                             : minutes + ":" + seconds + "." + milliseconds;
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
            this.UpdateLocation();
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
                pageType: this.GetPageType(location),
                url: location.pathname + location.search,
                videoId: videoId,
                playlistId: playlistId
            };
        }

        IsNotValidLocation() {
            if (this.location.pageType === "watch") {
                return false;
            }
            else {
                return true;
            }
        }

        GetPageType(location) {
            return location.pathname.indexOf("watch") !== -1 ? "watch" : "browse";
        }

        LoadConfig(data) {
            this.config = data;
        }

        SaveConfig(newConfig) {
            let event = new CustomEvent(this.events.onConfigSave.eventName, {
                detail: newConfig
            });
            this.dispatchEvent(event);
        }

        ClearConfig() {
            this.SaveConfig({});
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
            this.container.slideDuration = 500;

            this.root.appendChild(this.container);
            this.root.appendChild(this.openMenuButton);
        }

        MenuButtonClicked(event) {
            event.preventDefault();
            this.CalculateContainerHeight();
            if (this.container.classList.contains("open")) {
                this.Slide({
                    element: this.container,
                    fromValue: this.container.renderedHeight,
                    toValue: 0,
                    easingFunction: Utils.EaseUp,
                    completeFunction: () => {
                        this.SlideComplete(this.openMenuButton);
                    }
                });
            }
            else {
                this.Slide({
                    element: this.container,
                    fromValue: 0,
                    toValue: this.container.renderedHeight,
                    easingFunction: Utils.EaseDown,
                    completeFunction: () => {
                        this.SlideComplete(this.openMenuButton);
                    }
                });
            }
            this.container.classList.toggle("open");
            event.stopPropagation();
        }
        
        Slide({ element, fromValue, toValue, easingFunction, completeFunction }) {
            const LinearFit = Utils.LinearInterpolation(0, fromValue, 1, toValue);
            Utils.Animate({
                duration: element.slideDuration,
                timing: easingFunction,
                draw: function (progress) {
                    element.style.height = LinearFit(progress) + "px";
                },
                complete: completeFunction
            });
        }
        
        SlideComplete(element) {
            element.classList.toggle("open");
        }

        CreatePanelItem({ componentName, titleIconHtml, contentNode }) {
            componentName = componentName.replace(/(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))/, " $1")
                .replace(/(\S*)(.*\S*.*)/, '<span class="first">$1</span>$2');

            let componentMenu = document.createElement("div");
            componentMenu.className = "component-menu";
            componentMenu.GetRenderedHeight = this.GetRenderedHeight(componentMenu);

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
            componentContent.slideDuration = 300;

            contentNode.GetRenderedHeight = this.GetRenderedHeight(contentNode);

            componentContent.appendChild(contentNode);

            const HideContent = (event) => {
                event.preventDefault();
                
                if (componentContent.classList.contains("processing")) {
                    return;
                }

                componentContent.classList.add("processing");
                contentNode.renderedHeight = contentNode.renderedHeight || contentNode.GetRenderedHeight();
                if (componentContent.classList.contains("open")) {
                    this.container.renderedHeight -= contentNode.renderedHeight;
                    componentContent.style.overflow = "";
                    this.Slide({
                        element: componentContent,
                        fromValue: contentNode.renderedHeight,
                        toValue: 0,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            this.SlideComplete(hideContentButton);
                        }
                    });
                    this.Slide({
                        element: this.container,
                        fromValue: this.container.renderedHeight + contentNode.renderedHeight,
                        toValue: this.container.renderedHeight,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            componentContent.classList.remove("processing");
                        }
                    });
                }
                else {
                    this.container.renderedHeight += contentNode.renderedHeight;
                    this.Slide({
                        element: componentContent,
                        fromValue: 0,
                        toValue: contentNode.renderedHeight,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            this.SlideComplete(hideContentButton);
                            componentContent.style.overflow = "visible";
                        }
                    });
                    this.Slide({
                        element: this.container,
                        fromValue: this.container.renderedHeight - contentNode.renderedHeight,
                        toValue: this.container.renderedHeight,
                        easingFunction: Utils.EaseDown,
                        completeFunction: () => { 
                            componentContent.classList.remove("processing");
                        }
                    });
                }
                componentContent.classList.toggle("open");

                event.stopPropagation();
            }

            componentTitle.addEventListener("click", HideContent.bind(this));
            hideContentButton.addEventListener("click", HideContent.bind(this));

            componentMenu.appendChild(componentTitle);
            componentMenu.appendChild(componentContent);

            this.container.appendChild(componentMenu);
        }

        CalculateContainerHeight() {
            this.container.renderedHeight = 0;
            for (let elem of this.container.children) {
                this.container.renderedHeight += elem.GetRenderedHeight();
            }
        }

        GetRenderedHeight(element) {
            let computedStyle = window.getComputedStyle(element);
            let marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
            let marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
            return function () {
                if (computedStyle.length === 0) {
                    computedStyle = window.getComputedStyle(element);
                    marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
                    marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
                }
                if (isNaN(marginTop)) marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
                if (isNaN(marginBottom)) marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
                return element.offsetHeight + marginTop + marginBottom;
            }
        }

        LoadUI() {
            if (this.IsNotValidLocation()) {
                return;
            }
            let injectionTarget;
            if (!this.root.api
                && (injectionTarget = document.querySelector("ytd-watch-flexy #player")))
            {
                injectionTarget.insertAdjacentElement("afterend", this.root);
                this.root.api = this;
            }

            if (this.root.api) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }
    }

    class VolumeControl extends UIComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = 1;
        }

        Load() {
            if (this.IsNotValidLocation()) {
                return;
            }

            let videoElement;
            if (!this.gain
                && (videoElement = document.getElementsByClassName("html5-main-video")[0]))
            {
                let audioContext = new AudioContext();
                let source = audioContext.createMediaElementSource(videoElement);
                let gainNode = audioContext.createGain();
                this.gain = gainNode.gain;

                this.UpdateVolume();

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

        UpdateVolume() {
            this.UpdateLocation();
            this.UpdateVolumeByVideoId(this.location.videoId);
        }

        UpdateVolumeByVideoId(videoId) {
            this.gain.value =    this.config.list[videoId]
                              && this.config.list[videoId].volume
                              || this.DEFAULT_VALUE;
        }

        LoadUI() {
            if (this.IsNotValidLocation()) {
                return;
            }

            let injectionTarget;
            if (this.gain
                && !this.slider
                && (injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom "
                                      + ".ytp-chrome-controls .ytp-left-controls")))
            {
                let sliderContainer = document.createElement("div");

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-volume",
                    widjetOptions: {
                        min: 0,
                        max: 5,
                        value: this.gain.value,
                        range: "min",
                        step: 0.05,
                        slide: this.ChangeVolume.bind(this),
                        stop: this.VolumeConfirmed.bind(this)
                    }
                }).Initialize();
                injectionTarget.appendChild(sliderContainer);
            }

            if (!this.controls
                && (injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]))
            {
                this.controls = document.createElement("div");
                this.controls.className = "ytscript-controls-volume";

                let clearConfigButton = document.createElement("button");
                clearConfigButton.className = "ytscript-button";
                clearConfigButton.insertAdjacentHTML("beforeend", '<i class="fa fa-eraser"></i>');
                clearConfigButton.insertAdjacentText("beforeend", "Clear config");
                clearConfigButton.addEventListener("click", this.ClearConfig.bind(this));

                this.controls.appendChild(clearConfigButton);

                injectionTarget.api.CreatePanelItem({
                    componentName: this.name,
                    titleIconHtml: '<i class="fa fa-volume-up"></i>',
                    contentNode: this.controls
                });
            }

            if (this.slider && this.controls) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        VolumeConfirmed(event, ui) {
            this.config.list[this.location.videoId] = { volume: ui.value };
            this.SaveConfig(this.config);
        }

        ChangeVolume(event, ui) {
            this.gain.value = ui.value;
        }

        YtNavigateStarted(event) {
            if (event.detail.pageType === "watch") {
                this.UpdateControl();
            }
        }

        UpdateControl(videoId) {
            videoId && this.UpdateVolumeByVideoId(videoId)
                    || this.UpdateVolume();
            this.UpdateUI();
        }

        UpdateUI() {
            $(this.slider.api).slider("value", this.gain.value);
        }

        YtNavigateFinished(event) {
            this.UpdateControl();
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
            this.UpdateControl();
        }
    }

    class TrimControl extends UIComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = [0, 100];
            this.isProcessed = false;
        }

        Load() {
            if (this.IsNotValidLocation()) {
                return;
            }

            if (!this.player
                && (this.player = document.getElementById("movie_player")))
            {
                this.UpdateTrimIntervalByVideoId(this.location.videoId);
                if (this.trimInterval) {
                    this.player.seekTo(this.trimInterval[0]);
                    this.isProcessed = true;
                }
            }

            !this.videoElement && (this.videoElement = document.getElementsByClassName("html5-main-video")[0]);

            if (this.player && this.videoElement) {
                this.WatchVideoProgress();
                
                this.videoElement.addEventListener("durationchange", () => {
                    this.LinearFit = Utils.LinearInterpolation(this.DEFAULT_VALUE[0], 0,
                                                               this.DEFAULT_VALUE[1], this.videoElement.getDuration());
                    this.InverseLinearFit = Utils.LinearInterpolation(0, this.DEFAULT_VALUE[0],
                                                               this.videoElement.getDuration(), this.DEFAULT_VALUE[1]);
                });

                this.status.isLoaded = true;
                if (DEBUG) {
                    Log(`${this.name} has been loaded.`);
                }
            }
        }

        WatchVideoProgress() {
            this.animationFrameId = requestAnimationFrame(this.OnVideoProgress.bind(this));
        }

        OnVideoProgress() {
            if (this.trimInterval
                && this.InverseLinearFit
                && this.InverseLinearFit(this.trimInterval[1]) !== this.DEFAULT_VALUE[1])
            {
                if (this.videoElement.getCurrentTime() >= this.trimInterval[1]) {
                    this.videoElement.loop ? this.player.seekTo(this.trimInterval[0])
                                        : this.player.nextVideo();
                }
                this.WatchVideoProgress();
            }
        }

        UpdateTrimInterval() {
            this.UpdateLocation();
            this.UpdateTrimIntervalByVideoId(this.location.videoId);
        }

        UpdateTrimIntervalByVideoId(videoId) {
            this.trimInterval =    this.config.list[videoId]
                                && this.config.list[videoId].trim;
        }

        GetInversedTrimInterval() {
            return this.trimInterval && this.trimInterval.map(x => this.InverseLinearFit(x));
        }

        LoadUI() {
            if (this.IsNotValidLocation()) {
                return;
            }

            let injectionTarget;
            if (this.videoElement
                && this.LinearFit
                && !this.controls
                && (injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]))
            {
                let interval = this.GetInversedTrimInterval() || this.DEFAULT_VALUE;

                this.controls = document.createElement("div");
                this.controls.className = "ytscript-controls-trim";

                let sliderContainer = document.createElement("div");

                this.inputs = document.createElement("div");
                this.inputs.className = "input-container";
                let leftHandleInput = document.createElement("input");
                let rightHandleInput = document.createElement("input");
                leftHandleInput.type = rightHandleInput.type = "text";

                this.inputs.appendChild(leftHandleInput);
                this.inputs.appendChild(rightHandleInput);

                this.SetHandles(interval);

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-trim",
                    widjetOptions: {
                        min: this.DEFAULT_VALUE[0],
                        max: this.DEFAULT_VALUE[1],
                        values: interval,
                        range: true,
                        step: 0.1,
                        slide: (event, ui) => {
                            this.SetHandles(ui.values);
                        },
                        stop: this.IntervalConfirmed.bind(this)
                    }
                }).Initialize();

                let clearConfigButton = document.createElement("button");
                clearConfigButton.className = "ytscript-button";
                clearConfigButton.insertAdjacentHTML("beforeend", '<i class="fa fa-eraser"></i>');
                clearConfigButton.insertAdjacentText("beforeend", "Clear config");
                clearConfigButton.addEventListener("click", this.ClearConfig.bind(this));

                this.controls.appendChild(sliderContainer);
                this.controls.appendChild(this.inputs);
                this.controls.appendChild(clearConfigButton);

                injectionTarget.api.CreatePanelItem({
                    componentName: this.name,
                    titleIconHtml: '<i class="fa fa-scissors"></i>',
                    contentNode: this.controls
                });
            }

            if (this.controls) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        SetHandles(values) {
            let [a, b] = this.inputs.children;
            [a.value, b.value] = values.map(x => Utils.SecondsToTimeString(this.LinearFit(x)));
        }

        IntervalConfirmed(event, ui) {
            let interval = ui.values.map(x => this.LinearFit(x));

            if (ui.values[0] === this.DEFAULT_VALUE[0] && ui.values[1] === this.DEFAULT_VALUE[1]) {
                delete this.config[this.location.videoId];
                this.trimInterval = undefined;
            }
            else {
                this.config.list[this.location.videoId] = { trim: interval };
                this.trimInterval = interval;
                this.WatchVideoProgress();
            }

            this.SaveConfig(this.config);
        }

        YtNavigateStarted(event) {
            if (event.detail.pageType === "watch") {
                this.location.videoId = event.detail.endpoint.watchEndpoint.videoId;
                this.UpdateControl(this.location.videoId);
                this.isProcessed = true;
            }
        }

        UpdateControl(videoId) {
            videoId && this.UpdateTrimIntervalByVideoId(videoId)
                    || !videoId && this.UpdateTrimInterval();
            this.trimInterval && this.UpdatePlayer();
            this.UpdateUI();
        }

        UpdatePlayer() {
            this.WatchVideoProgress();

            this.videoElement.onprogress = () => {
                this.player.seekTo(this.trimInterval[0]);
                this.videoElement.onprogress = null;
            };
        }

        UpdateUI() {
            let interval = this.GetInversedTrimInterval() || this.DEFAULT_VALUE;
            $(this.slider.api).slider("values", interval)
            this.SetHandles(interval);
        }

        YtNavigateFinished(event) {
            this.UpdateUI();
            if (!this.isProcessed) {
                this.UpdateControl();
            }
            this.isProcessed = false;
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
            this.UpdateTrimInterval();
            this.UpdateUI();
        }
    }
    /* End of Components */



    manager.AddComponent(new ComponentPanel())
           .AddComponent(new TrimControl())
           .AddComponent(new VolumeControl())
           .Initialize();
})();