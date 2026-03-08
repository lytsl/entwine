import { createLucideIcon } from "lucide-react";

const IssueIcon = createLucideIcon("Issue", [
	// Main Geometric Body
	["rect", { x: "6", y: "6", width: "12", height: "12", rx: "2", key: "body" }],

	// Top "Legs"
	["path", { d: "M10 2v4", key: "top-left" }],
	["path", { d: "M14 2v4", key: "top-right" }],

	// Right "Legs"
	["path", { d: "M18 10h4", key: "right-top" }],
	["path", { d: "M18 14h4", key: "right-bottom" }],

	// Left "Legs"
	["path", { d: "M6 10H2", key: "left-top" }],
	["path", { d: "M6 14H2", key: "left-bottom" }],

	// Bottom "Legs"
	["path", { d: "M10 18v4", key: "bottom-left" }],
	["path", { d: "M14 18v4", key: "bottom-right" }],
]);

export default IssueIcon;
