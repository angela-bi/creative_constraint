import sounddevice as sd
import numpy as np
import bpy

# parts of code from https://github.com/F1dg3tXD/MAD/blob/main/MAD_OSX/mad.py and https://github.com/CGArtPython/blender_plus_python/blob/main/add-ons/simple_custom_panel/simple_custom_panel.py

def get_microphone_items(self, context):
    items = []
    for i, device in enumerate(sd.query_devices()):
        if device["max_input_channels"] > 0:
            label = f"{i}:{device['name']}"
            items.append((label, device["name"], ""))
    return items

class BRUSH_OT_change_brush_color(bpy.types.Operator):
    bl_idname = "brush.change_brush_color"
    bl_label = "Change Brush Color"
    bl_description = "Use audio input to set a random brush color"
    bl_options = {'REGISTER', 'UNDO'}
    
    def execute(self, context):

        try:
            duration = 0.1
            sample_rate = 44100
            audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
            sd.wait()
            audio = np.array(audio).flatten()

            rms = np.linalg.norm(audio) / np.sqrt(len(audio))
            print("RMS Volume:", rms)

            def safe_sample():
                return float(np.clip(np.random.choice(audio) * 10, 0.0, 1.0))

            r, g, b = safe_sample(), safe_sample(), safe_sample()

            brush = bpy.data.brushes.get("Tint")
            if brush:
                brush.color = (r, g, b)
                self.report({'INFO'}, f"Brush color set to: {(r, g, b)}")
            else:
                self.report({'WARNING'}, "Brush 'Tint' not found.")
            return {'FINISHED'}

        except Exception as e:
            self.report({'ERROR'}, f"Error: {str(e)}")
            return {'CANCELLED'}
    

class VIEW3D_PT_creative_constraints(bpy.types.Panel):  # class naming convention ‘CATEGORY_PT_name’

    # where to add the panel in the UI
    bl_space_type = "VIEW_3D"  # 3D Viewport area (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/space_type_items.html#rna-enum-space-type-items)
    bl_region_type = "UI"  # Sidebar region (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/region_type_items.html#rna-enum-region-type-items)

    bl_category = "Creative Constraints"  # found in the Sidebar
    bl_label = "Color to brush"  # found at the top of the Panel

    def draw(self, context): # function that defines layout
        layout = self.layout
        layout.label(text="Set Brush Color from Audio:")
        layout.operator("brush.change_brush_color", text="Change Brush Color")
        
classes = (
    BRUSH_OT_change_brush_color,
    VIEW3D_PT_creative_constraints,
)
        

def register():
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()