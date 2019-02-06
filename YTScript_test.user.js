// ==UserScript==
// @name         YTScript_test
// @description  YouTube player enhancement
// @author       michi-at
// @version      0.3.000
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

    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles_test.min.css";
    document.head.appendChild(link);



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
            component.index = Object.keys(this.components).length;
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
                    eventListener: this.RunCallbackIfAllowed(this.Load, this.IsValidLocation).bind(this),
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
                    eventListener: this.RunCallbackIfAllowed(this.YtNavigateStarted, this.IsComponentReady).bind(this),
                    useCapture: false
                },
                onYtNavigateFinish: {
                    eventTarget: window,
                    eventName: "yt-navigate-finish",
                    eventListener: this.RunCallbackIfAllowed(this.YtNavigateFinished, this.IsComponentReady).bind(this),
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

        IsComponentReady() {
            return this.status.isLoaded;
        }

        RunCallbackIfAllowed(callback, getPermission) {
            return function() {
                if (getPermission.call(this)) {
                    callback.apply(this, arguments);
                }
            }
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
        
        GetPageType(location) {
            return location.pathname.indexOf("watch") !== -1 ? "watch" : "browse";
        }

        IsValidLocation() {
            this.UpdateLocation();
            if (this.location.pageType === "watch") {
                return true;
            }
            else {
                return false;
            }
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
                eventListener: this.RunCallbackIfAllowed(this.LoadUI, this.IsValidLocation).bind(this),
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

        IsComponentReady() {
            return this.status.isLoaded && this.status.isUILoaded;
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

        CreatePanelItem({ componentName, componentIndex, titleIconHtml, contentNode }) {
            componentName = componentName.replace(/(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))/, " $1")
                .replace(/(\S*)(.*\S*.*)/, '<span class="first">$1</span>$2');

            let componentMenu = document.createElement("div");
            componentMenu.className = "component-menu";
            componentMenu.index = componentIndex;
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

            let children = [...this.container.children];
            let point = children.find(e => {
               return e.index > componentMenu.index;
            });
            this.container.insertBefore(componentMenu, point);
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
            let injectionTarget;
            if (!this.root.api
                && (injectionTarget = document.querySelector("ytd-watch-flexy #player")))
            {
                injectionTarget.insertAdjacentElement("afterend", this.root);
                this.root.api = this;
            }

            if (this.root.api) {
                this.status.isUILoaded = true;
            }
        }
    }

    class VolumeControl extends UIComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = 1;
            this.isProcessed = false;
        }

        Load() {
            if (!this.gain
                && (this.videoElement = document.getElementsByClassName("html5-main-video")[0]))
            {
                let audioContext = new AudioContext();
                let source = audioContext.createMediaElementSource(this.videoElement);
                let gainNode = audioContext.createGain();
                this.gain = gainNode.gain;

                this.UpdateVolume();

                gainNode.connect(audioContext.destination);
                source.connect(gainNode);

                this.isProcessed = true;
            }

            if (this.gain) {
                this.status.isLoaded = true;
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
                    componentIndex: this.index,
                    titleIconHtml: '<i class="fa fa-volume-up"></i>',
                    contentNode: this.controls
                });
            }

            if (this.slider && this.controls) {
                this.status.isUILoaded = true;
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
                this.location.videoId = event.detail.endpoint.watchEndpoint.videoId;
                this.Update(this.location.videoId);
                this.isProcessed = true;
            }
        }

        Update(videoId) {
            this.UpdatePlayer(videoId);
        }

        UpdatePlayer(videoId) {
            const Callback = () => {
                videoId && this.UpdateVolumeByVideoId(videoId)
                        || this.UpdateVolume();
                this.UpdateUI();

                this.dispatchEvent(new CustomEvent(
                    this.events.onListenerRemove.eventName, {
                        detail: {
                            eventTarget: this.videoElement,
                            eventName: "loadeddata",
                            eventListener: Callback,
                            useCapture: false
                        }
                    }
                ));
            };
            this.videoElement.addEventListener("loadeddata", Callback);
        }

        UpdateUI() {
            $(this.slider.api).slider("value", this.gain.value);
        }

        YtNavigateFinished(event) {
            this.UpdateUI();
            if (!this.isProcessed) {
                this.Update();
            }
            this.isProcessed = false;
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
            this.UpdateVolume();
            this.UpdateUI();
        }
    }

    class TrimControl extends UIComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = [0, 100];
            this.isProcessed = false;
        }

        Load() {
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
            return this.trimInterval && this.trimInterval.map(x => this.InverseLinearFit(x))
                   || this.DEFAULT_VALUE;
        }

        LoadUI() {
            let injectionTarget;
            if (this.videoElement
                && this.LinearFit
                && !this.controls
                && (injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]))
            {
                let interval = this.GetInversedTrimInterval();

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
                    componentIndex: this.index,
                    titleIconHtml: '<i class="fa fa-scissors"></i>',
                    contentNode: this.controls
                });
            }

            if (this.controls) {
                this.status.isUILoaded = true;
            }
        }

        SetHandles(values) {
            let [a, b] = this.inputs.children;
            [a.value, b.value] = values.map(x => Utils.SecondsToTimeString(this.LinearFit(x)));
        }

        IntervalConfirmed(event, ui) {
            let interval = ui.values.map(x => this.LinearFit(x));

            if (ui.values[0] === this.DEFAULT_VALUE[0] && ui.values[1] === this.DEFAULT_VALUE[1]) {
                delete this.config.list[this.location.videoId];
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
                this.Update(this.location.videoId);
                this.isProcessed = true;
            }
        }

        Update(videoId) {
            videoId && this.UpdateTrimIntervalByVideoId(videoId)
                    || !videoId && this.UpdateTrimInterval();
            this.trimInterval && this.UpdatePlayer();
            this.UpdateUI();
        }

        UpdatePlayer() {
            this.WatchVideoProgress();

            const Callback = () => {
                this.player.seekTo(this.trimInterval[0]);

                this.dispatchEvent(new CustomEvent(
                    this.events.onListenerRemove.eventName, {
                        detail: {
                            eventTarget: this.videoElement,
                            eventName: "loadeddata",
                            eventListener: Callback,
                            useCapture: false
                        }
                    }
                ));
            };
            this.videoElement.addEventListener("loadeddata", Callback);
        }

        UpdateUI() {
            let interval = this.GetInversedTrimInterval();
            $(this.slider.api).slider("values", interval)
            this.SetHandles(interval);
        }

        YtNavigateFinished(event) {
            this.UpdateUI();
            if (!this.isProcessed) {
                this.Update();
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

    class ScrollToCurrentVideoFix extends Component {
        constructor() {
            super();
        }

        IsValidLocation() {
            this.UpdateLocation();
            if (this.location.pageType === "watch" && this.location.url.indexOf("list=") !== -1) {
                return true;
            }
            else {
                return false;
            }
        }

        Load() {
            let manager;
            if (!this.playlistComponent
                && (manager = document.querySelector("yt-playlist-manager"))) {
                this.playlistComponent = manager.playlistComponent;

                this.playlistComponent.__proto__["scrollToCurrentVideo_"] = function () {
                    let items = this.$ && this.$.items;
                    let currentIndex = this.data && this.data.localCurrentIndex;
                    items && this.data && items.scrollToIndex(currentIndex);
                }
            }

            if (this.playlistComponent) {
                this.status.isLoaded = true;
            }
        }
    }



    manager.AddComponent(new ComponentPanel())
           .AddComponent(new TrimControl())
           .AddComponent(new VolumeControl())
           .AddComponent(new ScrollToCurrentVideoFix())
           .Initialize();
})();