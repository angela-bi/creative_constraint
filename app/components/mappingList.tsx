import React, { useState, useEffect } from "react";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Color } from "../page";

export type Input = "sound" | "brightness" | "nothing"
export type Mapping = {id: number, color?: Color, input?: Input} // when color and input are undefined, we render a plus sign

type MappingProps = {
    colors: Color[]
};

export function MappingList({ colors }: MappingProps) {
    const [mappings, setMappings] = useState<Mapping[]>([{id: 0, color: colors[1], input: "nothing"}, {id: 1}]); // this is the first empty plus sign
    const MAX_MAPPINGS = 4; // when we reach this number, stop rendering + sign
    const [activeMappingId, setActiveMappingId] = useState<number | null>(null); // this is the id number of the mapping who the user is selecting a color for

    let menu_colors = colors.slice(1) // this is excluding the white

    // for menu
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClose = () => {
        setAnchorEl(null);
    };

    // when the + button is clicked
    const handleAddMapping = (id: number) => {
        setMappings((prev: Mapping[]) => {
            // id
            const newId = prev.length > 0 ? Math.max(...prev.map((m) => m.id)) + 1 : 0;
      
            // used colors
            const usedColorNames = new Set(
                prev.filter(m => m.color).map(m => m.color?.name)
            );
            const nextColor = menu_colors.find(c => !usedColorNames.has(c.name)) ?? menu_colors[0];
            
            const updated: Mapping[] = prev.map((m) =>
                m.id === id
                ? { ...m, color: nextColor, input: "nothing" }
                : m
            );
        
            // new empty mapping at the end for + button--- if we've reached the limit, don't render + button anymore
            if ( usedColorNames.size < MAX_MAPPINGS - 1 ) {
                updated.push({ id: newId });
            }

            return updated;
        });
    };
       

    // when color button is clicked
    const handleColorButtonClick = (
        event: React.MouseEvent<HTMLElement>,
        id: number
      ) => {
        setAnchorEl(event.currentTarget);
        setActiveMappingId(id);
    };

    // when color is selected from menu
    const handleColorSelect = (color: Color) => {
        if (activeMappingId === null) return;
        setMappings((prev) =>
          prev.map((m) =>
            m.id === activeMappingId ? { ...m, color } : m
          )
        );
        handleClose();
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%"}}>
            {mappings.map((mapping) => {
                const { id, color, input } = mapping;

                if (!color && !input) {
                return (
                    <div
                    key={id}
                    style={{
                        borderRadius: "11px",
                        border: "1px solid gray",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                    }}
                    onClick={() => handleAddMapping(id)}
                    >
                    +
                    </div>
                );
                }

                return (
                <div key={id} style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
                    <button 
                        style={{ 
                            backgroundColor: `rgb(${color!.rgb[0]}, ${color!.rgb[1]}, ${color!.rgb[2]})`,
                            border: "none",
                            borderRadius: "11px",
                            width: "40px",
                            height: "40px",
                            cursor: "pointer",
                        }} 
                        onClick={(e) => handleColorButtonClick(e, id)}
                    />
                    <select
                        value={input}
                        onChange={(e) =>
                            setMappings((prev) =>
                            prev.map((m) =>
                                m.id === id ? { ...m, input: e.target.value as Input } : m
                            )
                            )
                        }
                    >
                        <option value="nothing">Nothing</option>
                        <option value="sound">Sound</option>
                        <option value="brightness">Brightness</option>
                    </select>

                    {activeMappingId === id && (
                        <Menu
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
                        transformOrigin={{ horizontal: "left", vertical: "top" }}
                      >
                            <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: "white",
                                padding: "10px",
                                borderRadius: "12px",
                                display: "flex",
                                gap: "1rem",
                            }}
                            >
                            {menu_colors.map((c) => (
                                <MenuItem
                                key={c.name}
                                onClick={() => handleColorSelect(c)}
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    backgroundColor: `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`,
                                    cursor: "pointer",
                                    boxShadow: c.name === color!.name ? "0px 2px 10px rgba(0,0,0,0.25)" : "0px solid #ccc",
                                }}
                                />
                            ))}
                            </div>
                            </Menu>
                        )}
                </div>
                );
            })}
            </div>
    )
}