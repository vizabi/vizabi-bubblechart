import {
  Chart,
  Icons,
  Utils,
  LegacyUtils as utils,
  axisSmart,
  Labels,
  DynamicBackground,
  Exporter as svgexport,
} from "VizabiSharedComponents";
import PanZoom from "./panzoom";

import {
  runInAction
} from "mobx";

import {decorate, computed} from "mobx";

const {ICON_WARN, ICON_QUESTION} = Icons;
const COLOR_WHITEISH = "rgb(253, 253, 253)";

const marginScaleH = (marginMin, ratio = 0) => height => marginMin + height * ratio;
const marginScaleW = (marginMin, ratio = 0) => width => marginMin + width * ratio;

function isTrailBubble(d){
  return !!d[Symbol.for("trailHeadKey")];
}

const PROFILE_CONSTANTS = (width, height, options) => ({
  SMALL: {
    margin: { top: 30, bottom: 35, left: 30, right: 10},
    leftMarginRatio: 1,
    padding: 2,
    minRadiusPx: 0.5,
    maxRadiusEm: options.ui.maxRadiusEm || 0.05,
    infoElHeight: 16,
    yAxisTitleBottomMargin: 6,
    xAxisTitleBottomMargin: 4
  },
  MEDIUM: {
    margin: { top: 15, bottom: 40, left: 40, right: 15},
    leftMarginRatio: 1.6,
    padding: 2,
    minRadiusPx: 1,
    maxRadiusEm: options.ui.maxRadiusEm || 0.05,
    infoElHeight: 20,
    yAxisTitleBottomMargin: 3,
    xAxisTitleBottomMargin: 4
  },
  LARGE: {
    margin: { top: 15, bottom: marginScaleH(30, 0.03)(height), left: marginScaleW(31, 0.015)(width), right: 20},
    leftMarginRatio: 1.8,
    padding: 2,
    minRadiusPx: 1,
    maxRadiusEm: options.ui.maxRadiusEm || 0.05,
    infoElHeight: 22,
    yAxisTitleBottomMargin: 3,//marginScaleH(4, 0.01)(height),
    xAxisTitleBottomMargin: marginScaleH(0, 0.01)(height),
    hideSTitle: true
  }
});

const PROFILE_CONSTANTS_FOR_PROJECTOR = (width, height, options) => ({
  MEDIUM: {
    margin: { top: 20, bottom: 55, left: 50, right: 20 },
    yAxisTitleBottomMargin: 3,
    xAxisTitleBottomMargin: 4,
    infoElHeight: 26,
  },
  LARGE: {
    margin: { top: 30, bottom: marginScaleH(45, 0.03)(height), left: marginScaleW(35, 0.025)(width), right: 30 },
    yAxisTitleBottomMargin: 3,//marginScaleH(4, 0.01)(height),
    xAxisTitleBottomMargin: marginScaleH(-10, 0.01)(height),
    infoElHeight: 32,
    hideSTitle: true
  }
});

// BUBBLE CHART COMPONENT
class _VizabiBubbleChart extends Chart {

  constructor(config) {
    config.subcomponents = [{
      type: Labels,
      placeholder: ".vzb-bc-labels",      
      options: {
        CSS_PREFIX: "vzb-bc",
        LABELS_CONTAINER_CLASS: "vzb-bc-labels",
        LINES_CONTAINER_CLASS: "vzb-bc-lines",
        SUPPRESS_HIGHLIGHT_DURING_PLAY: false
      },
      name: "labels"
    },{
      type: DynamicBackground,
      placeholder: ".vzb-bc-year"
    }];

    config.template = `
      <svg class="vzb-bubblechart-svg vzb-bubblechart-svg-back vzb-export">
          <g class="vzb-bc-graph">
              <g class="vzb-bc-year"></g>
              <svg class="vzb-bc-axis-x"><g></g></svg>
              <svg class="vzb-bc-axis-y"><g></g></svg>
              <line class="vzb-bc-projection-x"></line>
              <line class="vzb-bc-projection-y"></line>
              <svg class="vzb-bc-bubbles-crop">
                  <g class="vzb-bc-decorations">
                      <line class="vzb-bc-line-equal-xy vzb-invisible"></line>
                      <g class="vzb-bc-x-axis-groups"></g>
                  </g>    
              </svg>
          </g>
      </svg>
      <svg class="vzb-bubblechart-svg vzb-bubblechart-svg-main vzb-export">
          <g class="vzb-bc-graph">
              <g class="vzb-bc-axis-x-title"></g>
              <g class="vzb-bc-axis-x-info vzb-noexport"></g>

              <g class="vzb-bc-axis-y-title"></g>
              <g class="vzb-bc-axis-y-info vzb-noexport"></g>
              <svg class="vzb-bc-bubbles-crop">
                  <g class="vzb-zoom-selection"></g>
                  <rect class="vzb-bc-eventarea"></rect>
                  <g class="vzb-bc-trails"></g>
                  <g class="vzb-bc-bubbles"></g>
                  <rect class="vzb-bc-forecastoverlay vzb-hidden" x="0" y="0" width="100%" height="100%" fill="url(#vzb-bc-pattern-lines)" pointer-events='none'></rect>
              </svg>

              <g class="vzb-bc-axis-y-subtitle"></g>
              <g class="vzb-bc-axis-x-subtitle"></g>
              <g class="vzb-bc-axis-s-title"></g>
              <g class="vzb-bc-axis-c-title"></g>

              <g class="vzb-data-warning vzb-noexport">
                  <svg></svg>
                  <text></text>
              </g>

              <rect class="vzb-bc-zoom-rect"></rect>
          </g>
      </svg>
      <svg class="vzb-bubblechart-svg vzb-bubblechart-svg-front vzb-export">
          <g class="vzb-bc-graph">
              <svg class="vzb-bc-bubbles-crop">
                  <g class="vzb-bc-lines"></g>
                  <g class="vzb-bc-bubble-crown vzb-hidden">
                      <circle class="vzb-crown-glow"></circle>
                      <circle class="vzb-crown"></circle>
                  </g>        
              </svg>
              <svg class="vzb-bc-labels-crop">
                  <g class="vzb-bc-labels"></g>
              </svg>
          </g>
      </svg>
      <svg width="0" height="0">
          <defs>
              <filter id="vzb-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2"></feGaussianBlur>
              </filter>
            <pattern id="vzb-bc-pattern-lines" x="0" y="0" patternUnits="userSpaceOnUse" width="50" height="50" viewBox="0 0 10 10"> 
                <path d='M-1,1 l2,-2M0,10 l10,-10M9,11 l2,-2' stroke='black' stroke-width='3' opacity='0.08'/>
              </pattern> 
          </defs>
      </svg>
      <!-- This could possibly be another component -->
      <div class="vzb-tooltip vzb-hidden vzb-tooltip-mobile"></div>
    `;

    super(config);
  }

  setup() {

    this.DOM = {
      element: this.element,
      chartSvg: this.element.select("svg.vzb-bubblechart-svg-main"),
      chartSvgFront: this.element.select("svg.vzb-bubblechart-svg-front"),
      chartSvgBack: this.element.select("svg.vzb-bubblechart-svg-back"),
      chartSvgAll: this.element.selectAll("svg.vzb-bubblechart-svg"),
      graphAll: this.element.selectAll(".vzb-bc-graph"),
      bubbleContainerCropAll: this.element.selectAll(".vzb-bc-bubbles-crop"),
      zoomRect: this.element.select(".vzb-bc-zoom-rect"),
      eventArea: this.element.select(".vzb-bc-eventarea"),
      forecastOverlay: this.element.select(".vzb-bc-forecastoverlay"),
      tooltipMobile: this.element.select(".vzb-tooltip-mobile")
    };
    this.DOM.chartSvg.select(".vzb-bc-graph").call(graph => 
      Object.assign(this.DOM, {
        graph: graph,
        ySubTitleEl: graph.select(".vzb-bc-axis-y-subtitle"),
        xSubTitleEl: graph.select(".vzb-bc-axis-x-subtitle"),
        yTitleEl: graph.select(".vzb-bc-axis-y-title"),
        xTitleEl: graph.select(".vzb-bc-axis-x-title"),
        sTitleEl: graph.select(".vzb-bc-axis-s-title"),
        cTitleEl: graph.select(".vzb-bc-axis-c-title"),
        yInfoEl: graph.select(".vzb-bc-axis-y-info"),
        xInfoEl: graph.select(".vzb-bc-axis-x-info"),
        dataWarningEl: graph.select(".vzb-data-warning"),
        trailsContainer: graph.select(".vzb-bc-trails"),
        bubbleContainer: graph.select(".vzb-bc-bubbles"),
        bubbleContainerCrop: graph.select(".vzb-bc-bubbles-crop"),
        zoomSelection: graph.select(".vzb-zoom-selection"),
      })
    );
    this.DOM.chartSvgFront.select(".vzb-bc-graph").call(graphFront => 
      Object.assign(this.DOM, {
        graphFront: graphFront,
        labelsContainer: graphFront.select(".vzb-bc-labels"),
        labelsContainerCrop: graphFront.select(".vzb-bc-labels-crop"),
        linesContainer: graphFront.select(".vzb-bc-lines"),
        bubbleCrown: graphFront.select(".vzb-bc-bubble-crown")
      })
    );
    this.DOM.chartSvgBack.select(".vzb-bc-graph").call(graphBack => {
      Object.assign(this.DOM, {
        yAxisElContainer: graphBack.select(".vzb-bc-axis-y"),
        xAxisElContainer: graphBack.select(".vzb-bc-axis-x"),
        yearEl: graphBack.select(".vzb-bc-year"),
        projectionX: graphBack.select(".vzb-bc-projection-x"),
        projectionY: graphBack.select(".vzb-bc-projection-y"),
        decorationsEl: graphBack.select(".vzb-bc-decorations"),
      });
      this.DOM.yAxisEl = this.DOM.yAxisElContainer.select("g");
      this.DOM.xAxisEl = this.DOM.xAxisElContainer.select("g");
      this.DOM.lineEqualXY = this.DOM.decorationsEl.select(".vzb-bc-line-equal-xy");
      this.DOM.xAxisGroupsEl = this.DOM.decorationsEl.select(".vzb-bc-x-axis-groups");
    });

    //set filter
    this.DOM.bubbleCrown.selectAll(".vzb-crown-glow")
      .attr("filter", "url(" + location.pathname + "#vzb-glow-filter)");

    this._year = this.findChild({type: "DynamicBackground"});
    this._labels = this.findChild({type: "Labels"});
    this._panZoom = new PanZoom(this);
  
    this.scrollableAncestor = utils.findScrollableAncestor(this.element);

    this.xAxis = axisSmart("bottom");
    this.yAxis = axisSmart("left");


    this.isCanvasPreviouslyExpanded = false;
    this.draggingNow = null;

    this.wScale = d3.scaleLinear()
      .domain(this.ui.datawarning.doubtDomain)
      .range(this.ui.datawarning.doubtRange);

    this.hoverBubble = false;

    const _this = this;
    //keyboard listeners
    d3.select("body")
      .on("keydown", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (d3.event.metaKey || d3.event.ctrlKey) _this.DOM.chartSvgAll.classed("vzb-zoomin", true);
      })
      .on("keyup", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) _this.DOM.chartSvgAll.classed("vzb-zoomin", false);
      })
      //this is for the case when user would press ctrl and move away from the browser tab or window
      //keyup event would happen somewhere else and won't be captured, so zoomin class would get stuck
      .on("mouseenter", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) _this.DOM.chartSvgAll.classed("vzb-zoomin", false);
      });
  
    this.root.element.on("custom-resetZoom", () => {
      _this._panZoom.reset(null, 500);
    });

    this._panZoom.zoomSelection(this.DOM.bubbleContainerCrop);
    this.DOM.bubbleContainerCrop
      .call(this._panZoom.dragRectangle)
      .call(this._panZoom.zoomer)
      .on("dblclick.zoom", null)
      .on("mouseup", () => {
        _this.draggingNow = false;
      })
      .on("click", () => {
        const cursor = _this.ui.cursorMode;
        if (!d3.event.defaultPrevented && cursor !== "arrow" && cursor !== "hand") {
          _this._panZoom.zoomByIncrement(cursor, 500);
        }
      });

  }

  get MDL(){
    return {
      frame: this.model.encoding.get("frame"),
      selected: this.model.encoding.get("selected"),
      highlighted: this.model.encoding.get("highlighted"),
      superHighlighted: this.model.encoding.get("superhighlighted"),
      y: this.model.encoding.get(this.state.alias.y || "y"),
      x: this.model.encoding.get(this.state.alias.x || "x"),
      size: this.model.encoding.get("size"),
      color: this.model.encoding.get("color"),
      label: this.model.encoding.get("label"),
      trail: this.model.encoding.get("trail")
    };
  }

  draw() {
    this.localise = this.services.locale.auto();

    //this.MDL.trail.config.show = false;
    //this.ui.cursorMode = "plus";

    this.TIMEDIM = this.MDL.frame.data.concept;
    this.KEYS = this.model.data.space.filter(dim => dim !== this.TIMEDIM);

    if (this._updateLayoutProfile()) return; //return if exists with error
    this.addReaction(this._updateScales);
    this.addReaction(this._updateColorScale);
    this.addReaction(this._updateUIStrings);
    this.addReaction(this._updateSize);
    this.addReaction(this._updateMarkerSizeLimits);
    this.addReaction(this._updateSizeScale);
    this.addReaction(this._updateTrailsOnSelect);
    this.addReaction(this._updateTrailStart);
    //    this.addReaction(this._resetZoomMinMaxXReaction, this._resetZoomMinMaxX);
    //    this.addReaction(this._resetZoomMinMaxYReaction, this._resetZoomMinMaxY);
    this.addReaction(this._updateOpacity);
    this.addReaction(this._updateShowYear);
    this.addReaction(this._updateYear);
    this.addReaction(this.drawData);
    this.addReaction(this._zoomToMarkerMaxMin);

    this.addReaction(this._selectDataPoints);
    this.addReaction(this._highlightDataPoints);
    this.addReaction(this._blinkSuperHighlighted);
    this.addReaction(this._updateDoubtOpacity);
  }

  drawData() {
    this.processFrameData();
    this._createAndDeleteBubbles();
    //this.redrawData();
  }
  
  _updateTrailStart(){
    if (this.MDL.trail.show) this.MDL.trail.updateTrailStart(this.MDL.frame.framesAround[1]);
  }

  _updateTrailsOnSelect() {
    const selectedBubbles = this.MDL.selected.data.filter.markers;
    runInAction(() => {
      Object.keys(this.MDL.trail.config.starts).forEach(marker => {
        if (!selectedBubbles.has(marker)) {
          this.MDL.trail.deleteTrail({
            [Symbol.for("key")]: marker
          });
        }
      });
      for (const [marker] of selectedBubbles) {
        if (!this.MDL.trail.config.starts[marker]) {
          this.MDL.trail.setTrail({
            [Symbol.for("key")]: marker,
            [this.MDL.trail.groupDim]: this.MDL.frame.value
          });
        }
      }
    });
  }

  _updateShowYear() {
    this.DOM.yearEl.classed("vzb-hidden", !this.ui.timeInBackground);
  }

  _updateYear() {
    const duration = this._getDuration();
    this._year.setText(this.localise(this.MDL.frame.value), duration);    
  }

  _createAndDeleteBubbles() {
    const _this = this;
    const duration = this._getDuration();
    const transition = this._getTransition(duration);
    const data = this.__dataProcessed;

    this.bubbles = this.DOM.bubbleContainer.selectAll(".vzb-bc-entity")
      .data(this.__dataProcessed, d => d[Symbol.for("key")])
      .join(
        enter => enter
          .append(d => {
            if (isTrailBubble(d)) {
              const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
              g.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
              g.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "line"));
              return g;
            }
            return document.createElementNS("http://www.w3.org/2000/svg", "circle");
          })
          .attr("class", "vzb-bc-entity")
          .attr("id", d => `vzb-bc-bubble-${d[Symbol.for("key")]}-${this.id}`)
          .style("opacity", d => d[Symbol.for("opacity")] = this._getBubbleOpacity(d))
          .call(selection => {
            if(!utils.isTouchDevice()){
              selection
                .on("mouseover", this._bubblesInteract().mouseover)
                .on("mouseout", this._bubblesInteract().mouseout)
                .on("click", this._bubblesInteract().click);
            } else {
              selection
                .on("tap", this._bubblesInteract().tap);
            }
          })
          .each(function(d, index) {
            const dataNext = data[index + 1] || {};
            const isTrail = isTrailBubble(d);
            const headTrail = isTrail && !dataNext[Symbol.for("trailHeadKey")];
            const node = isTrail ? this.children[0] : this;
            //console.log("enter", d, headTrail)
      
            const valueX = d[_this.__alias("x")];
            const valueY = d[_this.__alias("y")];
            const valueS = d.size;
            const valueC = d.color;
      
            //d.hidden = (!valueS && valueS !== 0) || valueX == null || valueY == null;
      
            //view.classed("vzb-hidden", d.hidden);
            d.r = utils.areaToRadius(_this.sScale(valueS || 0));
            const scaledX = _this.xScale(valueX);
            const scaledY = _this.yScale(valueY);
            const scaledC = valueC != null ? _this.cScale(valueC) : COLOR_WHITEISH;
      
            const view = d3.select(node);
            if (!duration || !headTrail) {
              view
                .attr("r", d.r)
                .attr("fill", scaledC)
                .attr("cy", scaledY)
                .attr("cx", scaledX);
              //.transition(transition)
      
              //trail line
              if (isTrail) {
                const lineView = d3.select(node.nextSibling);

                const scaledX0 = _this.xScale(dataNext[_this.__alias("x")]);
                const scaledY0 = _this.yScale(dataNext[_this.__alias("y")]);
                
                lineView
                  .attr("x1", scaledX)
                  .attr("y1", scaledY)
                  .attr("x2", scaledX0)
                  .attr("y2", scaledY0)
                  .style("stroke", scaledC)
                  .attr("stroke-dasharray", Math.abs(scaledX - scaledX0) + Math.abs(scaledY - scaledY0))
                  .attr("stroke-dashoffset", -d.r);
              }
            }
      
            if (duration && !isTrail) {
              view
                .style("opacity", 0)
                .transition().duration(duration*0.9)
                .style("opacity", d[Symbol.for("opacity")]);
            }
      
            if (!isTrail) {
              _this._updateLabel(d, valueX, valueY, duration, true, false);
            }
          }),

        update => update
          .each(function(d, index) {
            
            const isTrail = isTrailBubble(d);
            const dataNext = data[index + 1] || {};
            const dataNext2 = data[index + 2] || {};
            const headTrail = isTrail && !dataNext[Symbol.for("trailHeadKey")];
            const headTrail2 = isTrail && !dataNext2[Symbol.for("trailHeadKey")];
      
            const valueS = d.size;
            d.r = utils.areaToRadius(_this.sScale(valueS || 0));
            if (isTrail && !headTrail && !headTrail2) return;
      
            const valueX = d[_this.__alias("x")];
            const valueY = d[_this.__alias("y")];
            const valueC = d.color;
      
            //d.hidden = (!valueS && valueS !== 0) || valueX == null || valueY == null;
      
            //view.classed("vzb-hidden", d.hidden);
            const scaledX = _this.xScale(valueX);
            const scaledY = _this.yScale(valueY);
            const scaledC = valueC != null ? _this.cScale(valueC) : COLOR_WHITEISH;
      
            if (!duration || !headTrail) {
              const node = isTrail ? this.children[0] : this;
              const view = duration && !isTrail ?
                d3.select(node).transition(transition)
                :
                d3.select(node).interrupt();
          
              view
                .attr("r", d.r)
                .attr("fill", scaledC)
                .attr("cy", scaledY)
                .attr("cx", scaledX);

              
            
              //trail line
              if (isTrail) {
                const lineView = d3.select(node.nextSibling);

                const scaledX0 = _this.xScale(dataNext[_this.__alias("x")]);
                const scaledY0 = _this.yScale(dataNext[_this.__alias("y")]);
                
                lineView
                  .attr("x1", scaledX)
                  .attr("y1", scaledY);
                if (duration && !data[index + 2][Symbol.for("trailHeadKey")]) {
                  lineView
                    .attr("x2", scaledX)
                    .attr("y2", scaledY)
                    .transition(transition)
                    .attr("x2", scaledX0)
                    .attr("y2", scaledY0);
                } else {
                  lineView.interrupt()
                    .attr("x2", scaledX0)
                    .attr("y2", scaledY0);
                }
      
                lineView
                  .style("stroke", scaledC)
                  .attr("stroke-dasharray", Math.abs(scaledX - scaledX0) + Math.abs(scaledY - scaledY0))
                  .attr("stroke-dashoffset", -d.r);
              }
            }
            
            if (!isTrail)
              _this._updateLabel(d, valueX, valueY, duration, false, false);    
          }),    

        exit => exit
          .each(function(d) {
            const isTrail = isTrailBubble(d);
            const node = this;
            //console.log("exit", d)
            
            const view = duration && !isTrail ?
              d3.select(node).transition(transition)
                .duration(duration*0.9)
                .style("opacity", 0)
              :
              d3.select(node).interrupt();
      
            view
              .remove();
            
            if (!isTrail) 
              _this._updateLabel(d, d[_this.__alias("x")], d[_this.__alias("y")], duration, true, true);
          })
      )
      .order();

  }


  redrawData(duration) {
    this.services.layout.size;
    this.MDL.x.scale.type;
    this.MDL.y.scale.type;
    this.MDL.color.scale.type;
    this.MDL.size.scale.type;
    this.MDL.size.scale.extent;

    const _this = this;
    const data = this.__dataProcessed;

    if (this.bubbles) this.bubbles.each(function(d, index) {
      const isTrail = isTrailBubble(d);
      const node = isTrail ? this.children[0] : this;

      const valueX = d[_this.__alias("x")];
      const valueY = d[_this.__alias("y")];
      const valueS = d.size;
      const valueC = d.color;

      d.r = utils.areaToRadius(_this.sScale(valueS || 0));
      const scaledX = _this.xScale(valueX);
      const scaledY = _this.yScale(valueY);
      const scaledC = valueC != null ? _this.cScale(valueC) : COLOR_WHITEISH;

      const view = duration ? 
        d3.select(node)
          .transition()
          .duration(duration)
        : d3.select(node).interrupt();
      view
        .attr("r", d.r)
        .attr("fill", scaledC)
        .attr("cy", scaledY)
        .attr("cx", scaledX);

      if (isTrail) {
        const lineView = duration ? 
          d3.select(node.nextSibling)
            .transition()
            .duration(duration)
          : d3.select(node.nextSibling).interrupt();

        const dataNext = data[index + 1];
        const scaledX0 = _this.xScale(dataNext[_this.__alias("x")]);
        const scaledY0 = _this.yScale(dataNext[_this.__alias("y")]);

        lineView
          .attr("x1", scaledX)
          .attr("y1", scaledY)
          .attr("x2", scaledX0)
          .attr("y2", scaledY0)
          .style("stroke", scaledC)
          .attr("stroke-dasharray", Math.abs(scaledX - scaledX0) + Math.abs(scaledY - scaledY0))
          .attr("stroke-dashoffset", -d.r);
      }
    });

    _this._updateLabels();
  }

  __getZoomed(type, zoomed, domain) {
    //const zoomed = values[`zoomed${type}`];
    return d3[type.toLowerCase()](zoomed !== null ? zoomed : domain);
  }

  __getZoomedMin(values, domain) {
    return this.__getZoomed("Min", values, domain);
  }

  __getZoomedMax(values, domain) {
    return this.__getZoomed("Max", values, domain);
  }

  /*
   * Zoom to the min and max values given in the URL axes markers.
   */
  _zoomToMarkerMaxMin() {
    this.services.layout.size;
    this.MDL.x.scale.type;
    this.MDL.y.scale.type;

    const panzoom = //this.ui.panzoom;
    {
      x: this.MDL.x.scale.zoomed,
      y: this.MDL.y.scale.zoomed
    };
    
    const xDomain = this.MDL.x.data.domain;
    const yDomain = this.MDL.y.data.domain;

    if (this.draggingNow) return;

    /*
     * Reset just the zoom values without triggering a zoom event. This ensures
     * a clean zoom state for the subsequent zoom event.
     */
    this._panZoom.resetZoomState();

    this.yScale.range(this._rangeBump([this.height, 0]));
    this.xScale.range(this._rangeBump([0, this.width]));
   
    /*
     * The axes may return null when there is no value given for the zoomed
     * min and max values. In that case, fall back to the axes' domain values.
     */
    const zoomedMinX = this.__getZoomedMin(panzoom.x, xDomain);
    const zoomedMaxX = this.__getZoomedMax(panzoom.x, xDomain);
    const zoomedMinY = this.__getZoomedMin(panzoom.y, yDomain);
    const zoomedMaxY = this.__getZoomedMax(panzoom.y, yDomain);

    //by default this will apply no transition and feed values back to state
    runInAction(() => {
      this._panZoom.zoomToMaxMin(zoomedMinX, zoomedMaxX, zoomedMinY, zoomedMaxY, 0, "don't feed these zoom values back to state");
    });
  }

  _resetZoomMinMaxXReaction() {
    return { concept: this.MDL.x.data.concept };
  }

  _resetZoomMinMaxX() {
    this.ui.panzoom.x = {zoomedMin: null, zoomedMax: null};
  }

  _resetZoomMinMaxYReaction() {
    return { concept: this.MDL.y.data.concept };
  }

  _resetZoomMinMaxY() {
    this.ui.panzoom.y = {zoomedMin: null, zoomedMax: null};
  }

  _drawForecastOverlay() {
    this.DOM.forecastOverlay.classed("vzb-hidden", 
      !this.MDL.frame.endBeforeForecast || 
      !this.ui.showForecastOverlay || 
      (this.MDL.frame.value <= this.MDL.frame.endBeforeForecast)
    );
  }

  _updateLayoutProfile(){
    this.services.layout.size;

    this.elementHeight = (this.element.node().clientHeight) || 0;
    this.elementWidth = (this.element.node().clientWidth) || 0;

    this.profileConstants = this.services.layout.getProfileConstants(
      PROFILE_CONSTANTS(this.elementWidth, this.elementHeight, { ui: this.ui }), 
      PROFILE_CONSTANTS_FOR_PROJECTOR(this.elementWidth, this.elementHeight, { ui: this.ui }));

    if (!this.elementHeight || !this.elementWidth) return utils.warn("Chart _updateProfile() abort: container is too little or has display:none");

  }

  _getDuration() {
    return this.MDL.frame.playing ? this.MDL.frame.speed || 0 : 0;
  }

  _updateScales() {
    this.yScale = this.MDL.y.scale.d3Scale.copy();
    this.xScale = this.MDL.x.scale.d3Scale.copy();
    this._labels.setScales(this.xScale, this.yScale);
  }

  _updateSizeScale() {
    this.sScale = this.MDL.size.scale.d3Scale.copy();
  }

  _updateColorScale() {
    this.cScale = this.MDL.color.scale.d3Scale.copy();
  }
  
  _updateUIStrings() {
    const {
      y, x, size, color
    } = this.MDL;

    const {
      xTitleEl,
      yTitleEl,
      sTitleEl,
      xSubTitleEl,
      ySubTitleEl,
      dataWarningEl,
      xInfoEl,
      yInfoEl
    } = this.DOM;

    const _this = this;

    this.strings = {
      title: {
        Y: Utils.getConceptName(y, this.localise),
        X: Utils.getConceptName(x, this.localise),
        S: Utils.getConceptName(size, this.localise),
        C: Utils.getConceptName(color, this.localise)
      },
      title_short: {
        Y: Utils.getConceptShortName(y, this.localise),
        X: Utils.getConceptShortName(x, this.localise),
        S: Utils.getConceptShortName(size, this.localise),
        C: Utils.getConceptShortName(color, this.localise)
      },
      subtitle: {
        Y: Utils.getConceptNameMinusShortName(y, this.localise),
        X: Utils.getConceptNameMinusShortName(x, this.localise)
      },
      unit: {
        Y: Utils.getConceptUnit(y),
        X: Utils.getConceptUnit(x),
        S: Utils.getConceptUnit(size),
        C: Utils.getConceptUnit(color)
      }
    };

    ySubTitleEl.selectAll("text").data([0])
      .join("text");
    xSubTitleEl.selectAll("text").data([0])
      .join("text");

    yTitleEl.selectAll("text").data([0])
      .join("text")
    //.attr("y", "-6px")
      .on("click", () => {
        this.root.findChild({type: "TreeMenu"})
          .encoding(this.__alias("y"))
          .alignX(this.services.locale.isRTL() ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    xTitleEl.selectAll("text").data([0])
      .join("text")
      .on("click", () => {
        this.root.findChild({type: "TreeMenu"})
          .encoding(this.__alias("x"))
          .alignX(this.services.locale.isRTL() ? "right" : "left")
          .alignY("bottom")
          .updateView()
          .toggle();
      });

    sTitleEl.selectAll("text").data([0])
      .join("text")
      .attr("text-anchor", "end");

    utils.setIcon(dataWarningEl, ICON_WARN).select("svg").attr("width", "0px").attr("height", "0px");
    dataWarningEl.append("text")
      .attr("text-anchor", "end")
      .text(this.localise("hints/dataWarning"));

    utils.setIcon(yInfoEl, ICON_QUESTION)
      .select("svg").attr("width", "0px").attr("height", "0px");

    utils.setIcon(xInfoEl, ICON_QUESTION)
      .select("svg").attr("width", "0px").attr("height", "0px");


    //TODO: move away from UI strings, maybe to ready or ready once
    yInfoEl.on("click", () => {
      _this.root.findChild({type: "DataNotes"}).pin();
    });
    yInfoEl.on("mouseover", function() {
      const rect = this.getBBox();
      const coord = utils.makeAbsoluteContext(this, this.farthestViewportElement)(rect.x - 10, rect.y + rect.height + 10);
      const toolRect = _this.root.element.node().getBoundingClientRect();
      const chartRect = _this.element.node().getBoundingClientRect();
      _this.root.findChild({type: "DataNotes"})
        .setEncoding(_this.MDL.y)
        .show()
        .setPos(coord.x + chartRect.left - toolRect.left, coord.y);
    });
    yInfoEl.on("mouseout", () => {
      _this.root.findChild({type: "DataNotes"}).hide();
    });
    xInfoEl.on("click", () => {
      _this.root.findChild({type: "DataNotes"}).pin();
    });
    xInfoEl.on("mouseover", function() {
      //if (_this.model.time.dragging) return;
      const rect = this.getBBox();
      const coord = utils.makeAbsoluteContext(this, this.farthestViewportElement)(rect.x - 10, rect.y + rect.height + 10);
      const toolRect = _this.root.element.node().getBoundingClientRect();
      const chartRect = _this.element.node().getBoundingClientRect();
      _this.root.findChild({type: "DataNotes"})
        .setEncoding(_this.MDL.x)
        .show()
        .setPos(coord.x + chartRect.left - toolRect.left, coord.y);
    });
    xInfoEl.on("mouseout", () => {
      //if (_this.model.time.dragging) return;
      _this.root.findChild({type: "DataNotes"}).hide();
    });
    dataWarningEl
      .on("click", () => {
        _this.root.findChild({type: "DataWarning"}).toggle();
      })
      .on("mouseover", () => {
        _this._updateDoubtOpacity(1);
      })
      .on("mouseout", () => {
        _this._updateDoubtOpacity();
      });
  }

  _updateSize() {
    this.services.layout.size;

    const {
      x,
      y
    } = this.MDL;
    
    const {
      graphAll,
      eventArea,
      bubbleContainerCropAll,
      labelsContainerCrop,
      xAxisElContainer,
      xAxisEl,
      yAxisElContainer,
      yAxisEl,
      projectionX,
      projectionY,
      sTitleEl,
      xTitleEl,
      yTitleEl,
      xSubTitleEl,
      ySubTitleEl,
      xAxisGroupsEl,
      xInfoEl,
      yInfoEl

    } = this.DOM;

    const _this = this;

    const layoutProfile = this.services.layout.profile;
    this.profileConstants.maxRadiusPx = Math.max(
      this.profileConstants.minRadiusPx,
      this.profileConstants.maxRadiusEm * utils.hypotenuse(this.elementWidth, this.elementHeight)
    );

    const margin = this.profileConstants.margin;
    const infoElHeight = this.profileConstants.infoElHeight;

    //labels
    this._labels.setCloseCrossHeight(_this.profileConstants.infoElHeight * 1.2);
    this._labels.setTooltipFontSize(_this.profileConstants.infoElHeight + "px");
    
    //stage
    const height = this.height = (this.elementHeight - margin.top - margin.bottom) || 0;
    const width = this.width = (this.elementWidth - margin.left * this.profileConstants.leftMarginRatio - margin.right) || 0;

    // if (height <= 0 || width <= 0) {
    //   height = 0;
    //   width = 0;
    //   utils.warn("Bubble chart updateSize(): vizabi container is too little or has display:none");
    // }

    //graph group is shifted according to margins (while svg element is at 100 by 100%)
    graphAll
      .attr("transform", "translate(" + (margin.left * this.profileConstants.leftMarginRatio) + "," + margin.top + ")");

    this._year.resizeText(width, height);
    //this.yearEl.classed("vzb-hidden", !this.ui.timeInBackground);
    //this.year.resize(width, height);
    
    eventArea
      .attr("width", width)
      .attr("height", Math.max(0, height));

    //update scales to the new range
    // // if (this.model.marker.y.scaleType !== "ordinal") {
    // //   this.yScale.range(this._rangeBump([height, 0]));
    // // } else {
    // //   this.yScale.rangePoints([height, 0], _this.profileConstants.padding).range();
    // // }
    // // if (this.model.marker.x.scaleType !== "ordinal") {
    // //   this.xScale.range(this._rangeBump([0, width]));
    // // } else {
    // //   this.xScale.rangePoints([0, width], _this.profileConstants.padding).range();
    // // }
    this.yScale.range(this._rangeBump([height, 0]));
    this.xScale.range(this._rangeBump([0, width]));

    //apply scales to axes and redraw
    this.yAxis.scale(this.yScale)
      .tickSizeInner(-width)
      .tickSizeOuter(0)
      .tickPadding(6)
      .tickSizeMinor(-width, 0)
      .labelerOptions({
        scaleType: y.scale.type,
        toolMargin: margin,
        limitMaxTickNumber: 6,
        bump: this.profileConstants.maxRadiusPx / 2,
        viewportLength: height,
        formatter: this.localise
      });

    this.xAxis.scale(this.xScale)
      .tickSizeInner(-height)
      .tickSizeOuter(0)
      .tickPadding(6)
      .tickSizeMinor(-height, 0)
      .labelerOptions({
        scaleType: x.scale.type,
        toolMargin: margin,
        bump: this.profileConstants.maxRadiusPx / 2,
        viewportLength: width,
        formatter: this.localise
      });


    bubbleContainerCropAll
      .attr("width", width)
      .attr("height", Math.max(0, height));

    labelsContainerCrop
      .attr("width", width)
      .attr("height", Math.max(0, height));

    xAxisElContainer
      .attr("width", width + 1)
      .attr("height", this.profileConstants.margin.bottom + height)
      .attr("y", -1)
      .attr("x", -1);
    xAxisEl
      .attr("transform", "translate(1," + (1 + height) + ")");

    yAxisElContainer
      .attr("width", this.profileConstants.margin.left + width)
      .attr("height", Math.max(0, height))
      .attr("x", -this.profileConstants.margin.left);
    yAxisEl
      .attr("transform", "translate(" + (this.profileConstants.margin.left - 1) + "," + 0 + ")");

    yAxisEl.call(this.yAxis);
    xAxisEl.call(this.xAxis);

    projectionX.attr("y1", _this.yScale.range()[0] + this.profileConstants.maxRadiusPx / 2);
    projectionY.attr("x2", _this.xScale.range()[0] - this.profileConstants.maxRadiusPx / 2);


    // reduce font size if the caption doesn't fit
    this._updateSTitle();
    sTitleEl
      .attr("transform", "translate(" + width + "," + 20 + ") rotate(-90)");

    if (layoutProfile !== "SMALL") {
      ySubTitleEl.select("text").attr("dy", infoElHeight * 0.6).text(this.strings.subtitle.Y);
      xSubTitleEl.select("text").attr("dy", -infoElHeight * 0.3).text(this.strings.subtitle.X);
      
      yTitleEl.select("text").text(this.strings.title_short.Y + " ")
        .append("tspan")
        .style("font-size", (infoElHeight * 0.7) + "px")
        .text("▼");
      xTitleEl.select("text").text(this.strings.title_short.X + " ")
        .append("tspan")
        .style("font-size", (infoElHeight * 0.7) + "px")
        .text("▼");
    } else {
      ySubTitleEl.select("text").text("");
      xSubTitleEl.select("text").text("");

      const yTitleText = yTitleEl.select("text").text(this.strings.title.Y);
      if (yTitleText.node().getBBox().width > width) yTitleText.text(this.strings.title_short.Y);
    
      const xTitleText = xTitleEl.select("text").text(this.strings.title.X);
      if (xTitleText.node().getBBox().width > width - 100) xTitleText.text(this.strings.title_short.X);      
    }

    const isRTL = this.services.locale.isRTL();
    ySubTitleEl
      .style("font-size", (infoElHeight * 0.8) + "px")
      .attr("transform", "translate(" + 0 + "," + 0 + ") rotate(-90)");
    xSubTitleEl
      .style("font-size", (infoElHeight * 0.8) + "px")
      .attr("transform", "translate(" + width + "," + height + ")");
  
    yTitleEl
      .style("font-size", infoElHeight + "px")
      .attr("transform", layoutProfile !== "SMALL" ?
        "translate(" + (-margin.left - this.profileConstants.yAxisTitleBottomMargin)  + "," + (height * 0.5) + ") rotate(-90)"
        : 
        "translate(" + (isRTL ? width : 10 - this.profileConstants.margin.left) + ", -" + this.profileConstants.yAxisTitleBottomMargin + ")");

    xTitleEl
      .style("font-size", infoElHeight + "px")
      .attr("transform", layoutProfile !== "SMALL" ?
        "translate(" + (width * 0.5) + "," + (height + margin.bottom - this.profileConstants.xAxisTitleBottomMargin) + ")"
        :
        "translate(" + (isRTL ? width : 0) + "," + (height + margin.bottom - this.profileConstants.xAxisTitleBottomMargin) + ")");
    
    xAxisGroupsEl
      .style("font-size", infoElHeight * 0.8 + "px");

    if (yInfoEl.select("svg").node()) {
      const titleBBox = yTitleEl.node().getBBox();
      const t = utils.transform(yTitleEl.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);
      const vTranslate = isRTL ? (t.translateY + infoElHeight * 1.4 + titleBBox.width * 0.5) : (t.translateY - infoElHeight * 0.4 - titleBBox.width * 0.5);
      const conceptPropsY = y.data.conceptProps;

      yInfoEl
        .classed("vzb-hidden", !conceptPropsY.description && !conceptPropsY.sourceLink || this.services.layout.projector)
        .select("svg")
        .attr("width", infoElHeight + "px")
        .attr("height", infoElHeight + "px");
      yInfoEl.attr("transform", layoutProfile !== "SMALL" ?
        "translate(" + (t.translateX - infoElHeight * 0.8) + "," + vTranslate + ") rotate(-90)"
        :
        "translate(" + hTranslate + "," + (t.translateY - infoElHeight * 0.8) + ")");
    }

    if (xInfoEl.select("svg").node()) {
      const titleBBox = xTitleEl.node().getBBox();
      const t = utils.transform(xTitleEl.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);
      const conceptPropsX = x.data.conceptProps;

      xInfoEl
        .classed("vzb-hidden", !conceptPropsX.description && !conceptPropsX.sourceLink || this.services.layout.projector)
        .select("svg")
        .attr("width", infoElHeight + "px")
        .attr("height", infoElHeight + "px");
      xInfoEl.attr("transform", "translate("
        + hTranslate + ","
        + (t.translateY - infoElHeight * 0.8) + ")");
    }

    this._resizeDataWarning();

    //this.services.layout.setHGrid([this.elementWidth - marginRightAdjusted]);
    //this.ui.margin.set("left", margin.left * this.profileConstants.leftMarginRatio, false, false);

    // (function(xMin, xMax, yMin, yMax) {
    //   if ((xMin && xMax && yMin && yMax) === null) return;
    //   _this._panZoom.zoomer.dontFeedToState = true;
    //   _this._panZoom.rerun(); // includes redraw data points and trail resize
    //   _this._panZoom.zoomToMaxMin(xMin, xMax, yMin, yMax, 0, true);
    // })(_this._zoomedXYMinMax.x.zoomedMin,
    //   _this._zoomedXYMinMax.x.zoomedMax,
    //   _this._zoomedXYMinMax.y.zoomedMin,
    //   _this._zoomedXYMinMax.y.zoomedMax);
  }

  _rangeBump(arg, undo) {
    const bump = this.profileConstants.maxRadiusPx / 2;
    undo = undo ? -1 : 1;
    if (utils.isArray(arg) && arg.length > 1) {
      let z1 = arg[0];
      let z2 = arg[arg.length - 1];

      //the sign of bump depends on the direction of the scale
      if (z1 < z2) {
        z1 += bump * undo;
        z2 -= bump * undo;
        // if the scale gets inverted because of bump, set it to avg between z1 and z2
        if (z1 > z2) z1 = z2 = (z1 + z2) / 2;
      } else if (z1 > z2) {
        z1 -= bump * undo;
        z2 += bump * undo;
        // if the scale gets inverted because of bump, set it to avg between z1 and z2
        if (z1 < z2) z1 = z2 = (z1 + z2) / 2;
      } else {
        // rangeBump error: the input scale range has 0 length. that sucks but we keep cool
      }
      return [z1, z2];
    }
    utils.warn("rangeBump error: input is not an array or empty");
  }

  _updateSTitle(titleS, titleC) {
    const { sTitleEl } = this.DOM;
    const {
      size,
      color
    } = this.MDL;
    // vertical text about size and color
    if (this.profileConstants.hideSTitle
      && this.root.ui.dialogs.dialogs.sidebar.indexOf("colors") > -1
      && this.root.ui.dialogs.dialogs.sidebar.indexOf("size") > -1) {
      sTitleEl.classed("vzb-invisible", true);
      return;
    }
    if (sTitleEl.classed("vzb-invisible")) {
      sTitleEl.classed("vzb-invisible", false);
    }
    const sTitleContentON = !size.data.constant;
    const cTitleContentON = !color.data.constant;
    const sTitleText = sTitleEl.select("text")
    // reset font size to remove jumpy measurement
      .style("font-size", null)
      .text(
        (sTitleContentON ? this.localise("buttons/size") + ": " + (titleS ? titleS : this.strings.title.S) : "") +
        (sTitleContentON && cTitleContentON ? ", " : "") +
        (cTitleContentON ? this.localise("buttons/colors") + ": " + (titleC ? titleC : this.strings.title.C) : "")
      );
    const sTitleWidth = sTitleText.node().getBBox().width;
    const remainigHeight = this.height - 30;
    const font = parseInt(sTitleText.style("font-size")) * remainigHeight / sTitleWidth;
    sTitleText.style("font-size", sTitleWidth > remainigHeight ? font + "px" : null);
  }

  _resizeDataWarning() {
    const {
      dataWarningEl,
      xTitleEl
    } = this.DOM;

    // reset font size to remove jumpy measurement
    const dataWarningText = dataWarningEl.select("text").style("font-size", null);

    // reduce font size if the caption doesn't fit
    const dataWarningWidth = dataWarningText.node().getBBox().width + dataWarningText.node().getBBox().height * 3;
    const remainingWidth = this.elementWidth - xTitleEl.node().getBBox().width - this.profileConstants.infoElHeight;
    const font = parseInt(dataWarningText.style("font-size")) * remainingWidth / dataWarningWidth;
    dataWarningText.style("font-size", dataWarningWidth > remainingWidth ? font + "px" : null);

    // position the warning icon
    const warnBB = dataWarningText.node().getBBox();
    dataWarningEl.select("svg")
      .attr("width", warnBB.height * 0.75)
      .attr("height", warnBB.height * 0.75)
      .attr("x", -warnBB.width - warnBB.height * 1.2)
      .attr("y", -warnBB.height * 0.65);

    dataWarningEl
      .classed("vzb-hidden", this.services.layout.projector)
      .attr("transform", "translate("
        + (this.services.locale.isRTL() ? warnBB.width + warnBB.height : this.width) + ","
        + (this.height + this.profileConstants.margin.bottom - this.profileConstants.xAxisTitleBottomMargin)
        + ")");
  }

  processFrameData() {
    return this.__dataProcessed = this.model.dataArray;
  }

  _getTransition(duration) {
    return duration ? d3.transition()
      .duration(duration)
      .ease(d3.easeLinear) : d3.transition();
  }  

  _bubblesInteract() {
    const _this = this;

    return {
      mouseover(d) {
        _this.hoverBubble = true;
        _this.MDL.highlighted.data.filter.set(d);
        _this._labels.showCloseCross(d, true);
      },

      mouseout(d) {
        _this.hoverBubble = false;
        _this.MDL.highlighted.data.filter.delete(d);
        //_this._setTooltip();
        _this._labels.showCloseCross(d, false);
      },

      click(d) {
        if (_this.draggingNow) return;
        // // const isSelected = d.isSelected;
        if (!isTrailBubble(d)) _this.MDL.selected.data.filter.toggle(d);
        //_this.MDL.selected.data.filter.toggle(d);
        // // //return to highlighted state
        // // if (!utils.isTouchDevice()) {
        // //   if (isSelected) _this.model.marker.highlightMarker(d);
        // //   _this.highlightDataPoints();
      }
    };
  }
  

  _updateMarkerSizeLimits() {
    this.services.layout.size;

    //if (!this.profileConstants) return utils.warn("updateMarkerSizeLimits() is called before ready(). This can happen if events get unfrozen and getFrame() still didn't return data");
    const {
      minRadiusPx,
      maxRadiusPx
    } = this.profileConstants;
    
    const extent = this.MDL.size.scale.extent || [0, 1];
    
    let minArea = utils.radiusToArea(Math.max(maxRadiusPx * extent[0], minRadiusPx));
    let maxArea = utils.radiusToArea(Math.max(maxRadiusPx * extent[1], minRadiusPx));

    let range = minArea === maxArea? [minArea, maxArea] :
      d3.range(minArea, maxArea, (maxArea - minArea)/(this.MDL.size.scale.domain.length - 1)).concat(maxArea);

    this.MDL.size.scale.config.range = range;
  }

  _setTooltip(tooltipText, x, y, s, c, d) {
    if (tooltipText) {
      const labelValues = {};
      if (d) {
        labelValues.valueY = d[this.__alias("y")];
        labelValues.valueX = d[this.__alias("x")];
        labelValues.valueS = d.size;
        labelValues.valueC = d.color;
        labelValues.valueLST = d.size_label || null;
        labelValues.labelText = this.__labelWithoutFrame(d, this.localise);
      }

      const tooltipCache = {};
      tooltipCache.labelX0 = this.xScale.invert(x);
      tooltipCache.labelY0 = this.yScale.invert(y);
      tooltipCache.scaledS0 = s;
      tooltipCache.scaledC0 = null;

      this._labels.setTooltip(d, tooltipText, tooltipCache, labelValues);
    } else {
      this._labels.setTooltip();
    }
  }

  _getLabelText(d) {
    return this.KEYS.map(key => d.label[key]).join(",");
    ////  + (this.model.ui.chart.timeInTrails && time && (this.model.time.start - this.model.time.end !== 0) ? " " + time : "");
  }

  _updateOpacity(selection) {
    //this.MDL.frame.value; //listen

    const highlightedFilter = this.MDL.highlighted.data.filter;
    const selectedFilter = this.MDL.selected.data.filter;

    this.__highlightedMarkers = new Map(highlightedFilter.markers);
    this.__selectedMarkers = new Map(selectedFilter.markers);
    this.__someSelected = this.__selectedMarkers.size != 0;
    this.__someHighlighted = this.__highlightedMarkers.size != 0;

    const _selection = selection || this.bubbles;
    if (_selection) _selection.style("opacity", d => this._getBubbleOpacity(d, this.ui));
  }

  _getBubbleOpacity(d) { 
    const ui = this.ui;

    if (this.__highlightedMarkers.has(d[Symbol.for("key")])) return ui.opacityHighlight;
    if (isTrailBubble(d)) return ui.opacityRegular;
    if (this.__selectedMarkers.has(d[Symbol.for("key")])) return ui.opacitySelect;

    if (this.__someSelected) return ui.opacitySelectDim;
    if (this.__someHighlighted) return ui.opacityHighlightDim;

    return ui.opacityRegular;
  }

  _updateDoubtOpacity(opacity) {
    if (opacity == null) opacity = this.wScale(this.localise(this.MDL.frame.value));
    if (this.MDL.selected.data.filter.any()) opacity = 1;
    this.DOM.dataWarningEl.style("opacity", opacity);
  }

  _setBubbleCrown(x, y, r, glow, skipInnerFill) {
    const bubbleCrown = this.DOM.bubbleCrown;
    if (x != null) {
      bubbleCrown.classed("vzb-hidden", false);
      bubbleCrown.select(".vzb-crown")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", r)
        .attr("fill", skipInnerFill ? "none" : glow);
      bubbleCrown.selectAll(".vzb-crown-glow")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", r + 10)
        .attr("stroke", glow);

    } else {
      bubbleCrown.classed("vzb-hidden", true);
    }

  }

  /*
   * Shows and hides axis projections
   */
  _axisProjections(d) {
    const {
      projectionX,
      projectionY,
      xAxisEl,
      yAxisEl
    } = this.DOM;

    if (d != null) {

      const valueY = d[this.__alias("y")];
      const valueX = d[this.__alias("x")];
      const radius = d.r;

      //if (!valueY && valueY !== 0 || !valueX && valueX !== 0 || !valueS && valueS !== 0) return;

      if (this.ui.whenHovering.showProjectionLineX
        && this.xScale(valueX) > 0 && this.xScale(valueX) < this.width
        && (this.yScale(valueY) + radius) < this.height) {
        projectionX
          .style("opacity", 1)
          .attr("y2", this.yScale(valueY) + radius)
          .attr("x1", this.xScale(valueX))
          .attr("x2", this.xScale(valueX));
      }

      if (this.ui.whenHovering.showProjectionLineY
        && this.yScale(valueY) > 0 && this.yScale(valueY) < this.height
        && (this.xScale(valueX) - radius) > 0) {
        projectionY
          .style("opacity", 1)
          .attr("y1", this.yScale(valueY))
          .attr("y2", this.yScale(valueY))
          .attr("x1", this.xScale(valueX) - radius);
      }

      if (this.ui.whenHovering.higlightValueX) xAxisEl.call(
        this.xAxis.highlightValue(valueX)
      );

      if (this.ui.whenHovering.higlightValueY) yAxisEl.call(
        this.yAxis.highlightValue(valueY)
      );


    } else {

      projectionX.style("opacity", 0);
      projectionY.style("opacity", 0);
      xAxisEl.call(this.xAxis.highlightValue("none"));
      yAxisEl.call(this.yAxis.highlightValue("none"));

    }

  }

  /*
   * Highlights all hovered bubbles
   */
  _highlightDataPoints() {
    const _this = this;

    const highlightedFilter = this.MDL.highlighted.data.filter;
    const selectedFilter = this.MDL.selected.data.filter;
    this.someHighlighted = highlightedFilter.any();

    //this.updateBubbleOpacity();
    const trailShow = this.MDL.trail.show;
    const trailStarts = this.MDL.trail.starts;
    const trailGroupDim = this.MDL.trail.groupDim;

    if (highlightedFilter.markers.size === 1) {
      const highlightedKey = highlightedFilter.markers.keys().next().value;
      const d = Object.assign(this.model.dataMap.getByObjOrStr(null, highlightedKey));
      const x = _this.xScale(d[_this.__alias("x")]);
      const y = _this.yScale(d[_this.__alias("y")]);
      const s = d.r;
      const c = d.color != null ? this.cScale(d.color) : COLOR_WHITEISH;
      let entityOutOfView = false;

      ////const titles = _this._formatSTitleValues(values.size[utils.getKey(d, dataKeys.size)], values.color[utils.getKey(d, dataKeys.color)]);
      ////_this._updateSTitle(titles[0], titles[1]);
      if (x + s < 0 || x - s > this.width || y + s < 0 || y - s > this.height) {
        entityOutOfView = true;
      }

      //show tooltip
      const selectedKey = d[Symbol.for("trailHeadKey")] || d[Symbol.for("key")];
      // const trailShow = this.MDL.trail.show;
      // const trailStarts = this.MDL.trail.starts;
      // const trailGroupDim = this.MDL.trail.groupDim;
      const isSelected = selectedFilter.has(selectedKey);
      const isTailTrail = !(trailStarts[selectedKey] - d[trailGroupDim]);
      const isTrail = isTrailBubble(d);

      let text = "";
      
      text = isSelected ? 
        !trailShow || isTailTrail || (!isTrail && !this.hoverBubble) ? "": this.localise(d.label[trailGroupDim])
        : 
        this.__labelWithoutFrame(d);
      
      _this._labels.highlight(null, false);
      _this._labels.highlight({ [Symbol.for("key")]: selectedKey }, true);
      if (isSelected) {
        const skipCrownInnerFill = !isTrail;
        //!d.trailStartTime || d.trailStartTime == _this.model.time.formatDate(_this.time);
        _this._setBubbleCrown(x, y, s, c, skipCrownInnerFill);
      }

      if (!entityOutOfView) {
        _this._axisProjections(d);
      }

      //set tooltip and show axis projections
      if (text && !entityOutOfView) {
        _this._setTooltip(text, x, y, s + 3, c, d);
      }

      // // const selectedData = utils.find(_this.model.marker.select, f => utils.getKey(f, KEYS) == d[KEY]);
      // // if (selectedData) {
      // //   const clonedSelectedData = utils.clone(selectedData);
      // //   //change opacity to OPACITY_HIGHLT = 1.0;
      // //   clonedSelectedData.opacity = 1.0;
      // //   _this._trails.run(["opacityHandler"], clonedSelectedData);
      // // }
    } else {
      this._axisProjections();
      ////this._trails.run(["opacityHandler"]);
      //hide tooltip
      //this._updateSTitle();
      this._setTooltip();
      this._setBubbleCrown();
      this._labels.highlight(null, false);
    }

  }

  _blinkSuperHighlighted() {
    if (!this.MDL.superHighlighted) return;

    const superHighlightFilter = this.MDL.superHighlighted.data.filter;

    this.bubbles
      .classed("vzb-super-highlighted", d => superHighlightFilter.has(d));
  }

  _selectDataPoints() {
    const _this = this;
    const selectedFilter = this.MDL.selected.data.filter;
    
    if (utils.isTouchDevice()) {
      _this.model.clearHighlighted();
      _this._labels.showCloseCross(null, false);
    } else {
      //hide tooltip
      _this._setTooltip();
      ////_this._setBubbleCrown();
    }

    // utils.forEach(_this.bubbles.data(), d => {
    //   d.isSelected = _this.model.marker.isSelected(d);
    // });

    _this.someSelected = selectedFilter.any();
    _this.nonSelectedOpacityZero = false;

  }

  _updateLabel(d, x, y, duration, showhide, hidden) {
    const selectedMarkers = this.MDL.selected.data.filter.markers;
    const key = d[Symbol.for("key")];
    // only for selected markers
    if (selectedMarkers.has(key)) {
      const trail = this.MDL.trail;
  
      const cache = {};

      let labelText = "";

      //if (showhide && hidden && trail.show && trailStartTime && (trailStartTime < _this.time)) showhide = false;
      if (hidden && !trail.show) showhide = true;

      if (trail.show) {
        const trailStart = trail.starts[key];
        //console.log("trailstart", trailStart)
        // if this bubble is trail start bubble
        if (trailStart >= this.MDL.frame.value || showhide) {
          const trailData = this.model.getDataMapByFrameValue(trailStart).getByObjOrStr(null, key);
          
          cache.labelText = labelText = this.__labelWithFrame(trailData);
          cache.labelX0 = trailData[this.__alias("x")];
          cache.labelY0 = trailData[this.__alias("y")];
          cache.scaledC0 = trailData.color != null ? this.cScale(trailData.color) : COLOR_WHITEISH,
          cache.scaledS0 = (trailData.size || trailData.size === 0) ? utils.areaToRadius(this.sScale(trailData.size)) : null;
          cache.valueS0 = trailData.size;
          trailData.hidden = hidden;
          this._labels.updateLabel(trailData, cache, cache.labelX0, cache.labelY0, trailData.size, trailData.color, labelText, trailData.size_label, duration, showhide);
        }
      } else {
        cache.labelText = labelText = this.__labelWithoutFrame(d);
        cache.labelX0 = x;
        cache.labelY0 = y;
        cache.scaledC0 = d.color != null ? this.cScale(d.color) : COLOR_WHITEISH,
        cache.scaledS0 = (d.size || d.size === 0) ? utils.areaToRadius(this.sScale(d.size)) : null;
        cache.valueS0 = d.size;
        d.hidden = hidden;
        this._labels.updateLabel(d, cache, x, y, d.size, d.color, labelText, d.size_label, duration, showhide);
      }
    }
  }
  
  _updateLabels() {
    //console.log("updateLabels");

    const selectedFilter = this.MDL.selected.data.filter;
    const trail = this.MDL.trail;

    for (const key of selectedFilter.markers.keys()) {
      const cache = this._labels.cached[key];

      const d = (trail.show ? this.model.getDataMapByFrameValue(trail.starts[key]) : this.model.dataMap)
        .getByObjOrStr(null, key);
      
      cache.labelText = this[(trail.show && this.ui.timeInTrails ? "__labelWithFrame" : "__labelWithoutFrame")](d);
      cache.labelX0 = d[this.__alias("x")];
      cache.labelY0 = d[this.__alias("y")];
      cache.scaledC0 = d.color != null ? this.cScale(d.color) : COLOR_WHITEISH,
      cache.scaledS0 = (d.size || d.size === 0) ? utils.areaToRadius(this.sScale(d.size)) : null;
      cache.valueS0 = d.size;
      cache.initTextBBox = null;
      cache.initFontSize = null;
      this._labels.updateLabel({ [Symbol.for("key")]: key }, null, null, null, null, null, null, d.size_label);
    }
  }

  __labelWithoutFrame(d) {
    if (typeof d.label == "object") return Object.values(d.label).join(", ");
    if (d.label != null) return "" + d.label;
    return d[Symbol.for("key")];
  }

  __labelWithFrame(d) {
    return this.__labelWithoutFrame(d) + " " + this.localise(this.MDL.frame.value);
  }

  __alias(x) {
    return this.state.alias[x];
  }  
}

_VizabiBubbleChart.DEFAULT_UI = {
  show_ticks: true,
  showForecast: false,
  showForecastOverlay: true,
  pauseBeforeForecast: true,
  opacityHighlight: 1.0,
  opacitySelect: 1.0,
  opacityHighlightDim: 0.1,
  opacitySelectDim: 0.3,
  opacityRegular: 0.5,
  timeInBackground: true,
  timeInTrails: true,
  lockNonSelected: 0,
  numberFormatSIPrefix: true,
  panWithArrow: false,
  adaptMinMaxZoom: false,
  cursorMode: "arrow",
  zoomOnScrolling: true,
  decorations: {
    enabled: true,
    xAxisGroups: null //left to be set by external page
  },
  superhighlightOnMinimapHover: true,
  whenHovering: {
    showProjectionLineX: true,
    showProjectionLineY: true,
    higlightValueX: true,
    higlightValueY: true
  },
  labels: {
    enabled: true,
    dragging: true,
    removeLabelBox: false
  },
  margin: {
    left: 0,
    top: 0
  },
  datawarning: {
    doubtDomain: [],
    doubtRange: []
  }
};

//export default BubbleChart;
export const VizabiBubbleChart = decorate(_VizabiBubbleChart, {
  "MDL": computed
});

Chart.add("bubblechart", VizabiBubbleChart);
