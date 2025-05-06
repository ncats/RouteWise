import React, { useState, useContext } from "react";
import {
  FloatButton,
  Popover,
  Switch,
  Flex,
  Radio,
  Divider,
  Slider,
} from "antd";
import {
  ClearOutlined,
  SettingOutlined,
  VerticalAlignMiddleOutlined,
  CompassOutlined,
} from "@ant-design/icons";
import { MainContext } from "../../contexts/MainContext";
import { curveStyles, graphLayouts, mapGraphDataToCytoscape } from "../../helpers/commonHelpers";
import GraphLegend from "./GraphLegend";
import ApiStatusCheck from "./ApiStatusCheck";


const SETTINGS_TITLE = "Settings";
const LEGEND_TITLE = "Legend";

const Settings = () => {
  const [openSettings, setOpenSettings] = useState(false);
  const [openLegend, setOpenLegend] = useState(false);

  const [normalizeRolesEnabled, setNormalizeRolesEnabled] = useState(false);
  const [highlightAtoms, setHighlightAtoms] = useState(false);
  const [showAtomIndices, setAtomIndices] = useState(false);
  const {
    setCytoscapeGraph,
    appSettings,
    setAppSettings,
    setZoomLevel,
    setNetworkGraph,
    setAicpGraph,
    setSelectedEntity,
    layout,
    setLayout,
    duplicateReagents,
    setDuplicateReagents,
    aicpGraph,
    updateCytoscapeGraph,
  } = useContext(MainContext);

  const handleOpenSettingsChange = (newOpen) => {
    setOpenSettings(newOpen);
  };

  const handleOpenLegendChange = (newOpen) => {
    setOpenLegend(newOpen);
  };

  const formatter = (value) => `${value}px`;

  return (
    <FloatButton.Group
      shape="circle"
      style={{
        right: 24,
      }}
    >
      <FloatButton
        icon={<VerticalAlignMiddleOutlined />}
        type="primary"
        tooltip="Fit to screen"
        onClick={() => setZoomLevel(Math.random())} // reset zoom level which will trigger the fit to screen in rendering component
      />
      <FloatButton
        icon={<ClearOutlined />}
        type="primary"
        tooltip="Clear"
        onClick={() => {
          setNetworkGraph(null);
          setAicpGraph(null);
          setCytoscapeGraph([]);
          setSelectedEntity(null);
        }}
      />
      <Popover
        content={<GraphLegend />}
        title={LEGEND_TITLE}
        trigger="click"
        open={openLegend}
        placement="leftBottom"
        onOpenChange={handleOpenLegendChange}
      >
        <FloatButton
          icon={<CompassOutlined />}
          type="primary"
          tooltip={<div>Legend</div>}
        />
      </Popover>
      <Popover
        content={
          <Flex gap="middle" vertical>
            <Flex gap="middle">
              <div>Show Atom Indices in Depiction</div>
              <Switch
                value={showAtomIndices}
                onChange={(checked) => {
                  setAtomIndices(checked);
                  setAicpGraph(aicpGraph);
                  const mappedData = mapGraphDataToCytoscape(aicpGraph);
                  updateCytoscapeGraph(mappedData, checked, highlightAtoms, checked );
                }}
              />
            </Flex>
            <Flex gap="middle">
              <div>Show structures for the substances</div>
              <Switch
                value={appSettings.showStructures}
                onChange={(checked) => {
                  // update context setting
                  setAppSettings({ ...appSettings, showStructures: checked });

                  // re-map graph to show/hide any non-TM depictions
                  setCytoscapeGraph((prev) =>
                    prev.map((node) => {
                      // show all depictions
                      if (checked) {
                        if (node.data.svg !== "") {
                          node.data.type = "custom";
                        }
                      } else {
                        // show only TM reaction depictions
                        node.data.type = node.data.node_type !== "substance" && node.data.is_valid === "false"
                          ? ""
                          : node.data.node_type === "substance" && node.data.srole !== "tm"
                          ? ""
                          : "custom";
                      }
                      return node;
                    })
                  );
                }}
              />
            </Flex>
            <Divider style={{ margin: 0 }} />
            <Flex gap="middle">
              <div>Enable Normalize Roles for Reactions</div>
              <Switch
                value={normalizeRolesEnabled}
                onChange={(checked) => {
                  setNormalizeRolesEnabled(checked);
                  setAicpGraph(aicpGraph);
                  const mappedData = mapGraphDataToCytoscape(aicpGraph);
                  updateCytoscapeGraph(mappedData, checked, highlightAtoms, showAtomIndices );
                }}
              />
            </Flex>
            <Flex gap="middle">
              <div>Duplicate reagents and starting materials</div>
              <Switch
                value={duplicateReagents}
                onChange={(checked) => {
                  setDuplicateReagents(checked);
                }}
              />
            </Flex>
            <Divider style={{ margin: 0 }} />
            <Flex gap="middle">
              <div>Highlight Atom Indices in depictions</div>
              <Switch
                value={highlightAtoms}
                onChange={(checked) => {
                  setHighlightAtoms(checked);
                  setAicpGraph(aicpGraph);

                  const mappedData = mapGraphDataToCytoscape(aicpGraph);
                  // Update Cytoscape Graph (this will trigger re-fetching SVGs with or without highlighting)
                  updateCytoscapeGraph(mappedData, normalizeRolesEnabled, checked, showAtomIndices);
                }}
              />
            </Flex>
            <Divider style={{ margin: 0 }} />
            <Flex gap="middle">
              <div>Set edge style:</div>
              <Radio.Group
                onChange={(e) =>
                  setAppSettings({
                    ...appSettings,
                    edgeCurveStyle: e.target.value,
                  })
                }
                value={appSettings.edgeCurveStyle}
              >
                <Radio value={curveStyles.ROUND_TAXI}>Round Taxi</Radio>
                <Radio value={curveStyles.STRAIGHT}>Straight</Radio>
                {/* <Radio value={curveStyles.BEZIER}>Bezier</Radio> */}
                <Radio value={curveStyles.SEGMENTS}>Segments</Radio>
              </Radio.Group>
            </Flex>
            <Divider style={{ margin: 0 }} />
            <div>Product edge thickness (in pixels):</div>
            <Slider
              max={30}
              defaultValue={appSettings.productEdgeThickness}
              tooltip={{
                formatter,
              }}
              onChange={(value) => {
                setAppSettings({ ...appSettings, productEdgeThickness: value });
              }}
              marks={{
                0: "0px",
                15: "15px",
                30: "30px",
              }}
            />
            <Divider style={{ margin: 0 }} />
            <Flex gap="middle">
              <div>Graph layout:</div>
              <Radio.Group
                onChange={(e) => setLayout(e.target.value)}
                value={layout}
              >
                <Radio value={graphLayouts.HIERARCHICAL}>Hierarhical</Radio>
                <Radio value={graphLayouts.FORCE_DIRECTED}>
                  Force-directed
                </Radio>
              </Radio.Group>
            </Flex>
            <Divider style={{ margin: 0 }} />
            <ApiStatusCheck />
          </Flex>
        }
        title={SETTINGS_TITLE}
        trigger="click"
        open={openSettings}
        placement="leftBottom"
        onOpenChange={handleOpenSettingsChange}
      >
        <FloatButton
          icon={<SettingOutlined />}
          type="primary"
          tooltip={<div>Settings</div>}
        />
      </Popover>
    </FloatButton.Group>
  );
};

export { Settings };
