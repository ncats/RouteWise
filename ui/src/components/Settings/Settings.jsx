import React, { useState, useContext } from "react";
import {
  FloatButton,
  Popover,
  Switch,
  Flex,
  Radio,
  Divider,
  Slider,
  Modal,
  Typography,
} from "antd";
import {
  ClearOutlined,
  SettingOutlined,
  VerticalAlignMiddleOutlined,
  CompassOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { MainContext } from "../../contexts/MainContext";
import { curveStyles, graphLayouts } from "../../helpers/commonHelpers";
import GraphLegend from "./GraphLegend";

const SETTINGS_TITLE = "Settings";
const LEGEND_TITLE = "Legend";
const { Paragraph, Link, Title } = Typography;

const Settings = () => {
  const [openSettings, setOpenSettings] = useState(false);
  const [openLegend, setOpenLegend] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  const {
    setCytoscapeGraph,
    appSettings,
    setAppSettings,
    setZoomLevel,
    setNetworkGraph,
    aicpGraph,
    setAicpGraph,
    setSelectedEntity,
    layout,
    setLayout,
    duplicateReagents,
    setDuplicateReagents,
    normalizeRolesEnabled,
    setNormalizeRolesEnabled,
    highlightAtoms,
    setHighlightAtoms,
    showAtomIndices,
    setAtomIndices,
    useJsonSVGs,
    setUseJsonSVGs
  } = useContext(MainContext);

  const handleOpenSettingsChange = (newOpen) => {
    setOpenSettings(newOpen);
  };

  const handleOpenLegendChange = (newOpen) => {
    setOpenLegend(newOpen);
  };

  const formatter = (value) => `${value}px`;

  const reloadGraph = () => {
    setAicpGraph((prev) => (prev ? { ...prev } : null)); // Creates a shallow copy
  };

  return (
    <>
      <FloatButton.Group
        shape="circle"
        style={{
          right: 24,
        }}
      >
        <FloatButton
          icon={<InfoCircleOutlined />}
          type="primary"
          tooltip="Info"
          onClick={() => setIsInfoModalVisible(true)}
        />
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
                <div>Show structures for all the substances</div>
                <Switch
                  value={appSettings.showAllSubstanceStructure}
                  onChange={(checked) => {
                    // update context setting
                    setAppSettings({
                      ...appSettings,
                      showAllSubstanceStructure: checked,
                    });
                    // reload graph
                    reloadGraph();
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
              <Flex gap="middle">
                <div>Enable Normalize Roles for Reactions</div>
                <Switch
                  value={normalizeRolesEnabled}
                  onChange={(checked) => {
                    setNormalizeRolesEnabled(checked);
                    reloadGraph();
                  }}
                />
              </Flex>
              <Flex gap="middle">
                <div>Highlight Atom Indices in Reaction depictions</div>
                <Switch
                  value={highlightAtoms}
                  onChange={(checked) => {
                    setHighlightAtoms(checked);
                    reloadGraph();
                  }}
                  disabled={useJsonSVGs}
                />
              </Flex>
              <Flex gap="middle">
                <div>Show Atom Indices in Reaction Depiction</div>
                <Switch
                  value={showAtomIndices}
                  onChange={(checked) => {
                    setAtomIndices(checked);
                    reloadGraph();
                  }}
                  disabled={useJsonSVGs}
                />
              </Flex>
              <Flex gap="middle">
                <div>Utilize Structure SVGs from JSON</div>
                <Switch
                  value={useJsonSVGs}
                  onChange={(checked) => {
                    setUseJsonSVGs(checked);
                    if (checked) { // Set to false if JSON SVGs are used
                      setAtomIndices(false);
                      setHighlightAtoms(false);
                    } else { // Reset to default values if JSON SVGs are not used
                      setAtomIndices(false);
                      setHighlightAtoms(true);
                    }
                    // reload graph
                    reloadGraph();
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
                  setAppSettings({
                    ...appSettings,
                    productEdgeThickness: value,
                  });
                }}
                marks={{
                  0: "0px",
                  15: "15px",
                  30: "30px",
                }}
              />
              {/* <Divider style={{ margin: 0 }} />
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
              </Flex> */}
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

      {/* Info Modal */}
      <Modal
        title="Information"
        open={isInfoModalVisible}
        onCancel={() => setIsInfoModalVisible(false)}
        footer={null}
        width={600}
      >
        <Typography>
          <Title level={4}>Publications</Title>
          <Paragraph>
            Vorontcov, I., Miller, N., Walker, B., Yang, B., Soundararajan, J., Zahoránszky-Kőhalmi, G., <em>et al.</em> (2025). <b>RouteWise – An Integration Friendly Platform for Interactive Synthesis Routes</b>. <em>ChemRxiv</em>.{" "}
            <Link
              href="https://chemrxiv.org/doi/full/10.26434/chemrxiv-2025-9n358"
              target="_blank"
            >
              https://doi.org/10.26434/chemrxiv-2025-9n358
            </Link>
            <br />
            <em style={{ fontSize: "0.9em" }}>This content is a preprint and has not been peer-reviewed.</em>
          </Paragraph>
          <Paragraph>
            (2025). <b>Synthesis Route Identification and Prioritization in Reaction Knowledge Graphs</b>. <em>ChemRxiv</em>.{" "}
            <Link
              href="https://chemrxiv.org/doi/full/10.26434/chemrxiv-2025-0s3jp"
              target="_blank"
            >
              https://doi.org/10.26434/chemrxiv-2025-0s3jp
            </Link>
          </Paragraph>
          <Paragraph>
            Zahoránszky-Kőhalmi, G. <em>et al.</em> (2022). <b>Algorithm for the Pruning of Synthesis Graphs</b>. <em>J. Chem. Inf. Model.</em> 62(9), 2226–2238.{" "}
            <Link
              href="https://pubs.acs.org/doi/10.1021/acs.jcim.1c01202"
              target="_blank"
            >
              https://doi.org/10.1021/acs.jcim.1c01202
            </Link>
          </Paragraph>
          <Paragraph>
            (2024). <b>Path Toward High-Throughput Synthesis Planning via Performance Benchmarking</b>. <em>ChemRxiv</em>.{" "}
            <Link
              href="https://chemrxiv.org/doi/10.26434/chemrxiv-2024-pmjn8"
              target="_blank"
            >
              https://doi.org/10.26434/chemrxiv-2024-pmjn8
            </Link>
          </Paragraph>
          <Paragraph style={{ marginTop: "1.5em" }}>
            <b>RW API Swagger Page:</b>{" "}
            <a
              href={process.env.API_URL + "/api/v1/docs/aicp/rw_api"}
              target="_blank"
            >
              {process.env.API_URL + "/api/v1/docs/aicp/rw_api"}
            </a>
          </Paragraph>
          <Paragraph>
            Developed by the{" "}
            <Link href="https://ncats.nih.gov/" target="_blank">
              National Center for Advancing Translational Sciences (NCATS)
            </Link>
            .
          </Paragraph>
        </Typography>
      </Modal>
    </>
  );
};

export { Settings };
