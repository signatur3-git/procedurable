import { ParsedCommand, getArg } from '../command-parser';
import { CommandNamespace, CommandHandler, CommandResult } from '../command-registry';
import { fontParser } from '../../../generation/text/FontParser';

const handlers: CommandHandler[] = [
  {
    action: 'load',
    description: 'Load a font file',
    usage: 'text.load <name> path=<path>',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Font name required' };
      }

      const path = cmd.options.path;
      if (!path) {
        return { success: false, error: 'Font path required (use path=...)' };
      }

      try {
        await fontParser.loadFont(name, path);

        return {
          success: true,
          data: {
            name,
            message: `Font "${name}" loaded from ${path}`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: String(error)
        };
      }
    }
  },

  {
    action: 'list',
    description: 'List loaded fonts',
    usage: 'text.list',
    execute: async (): Promise<CommandResult> => {
      const fonts = fontParser.getFontNames();

      return {
        success: true,
        data: {
          fonts,
          count: fonts.length
        }
      };
    }
  },

  {
    action: 'outline',
    description: 'Get glyph outline for a character',
    usage: 'text.outline <char> font=<name> [size=<size>]',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const char = getArg(cmd, 0);
      if (!char) {
        return { success: false, error: 'Character required' };
      }

      const fontName = cmd.options.font;
      if (!fontName) {
        return { success: false, error: 'Font name required (use font=...)' };
      }

      const size = cmd.options.size ? parseFloat(cmd.options.size) : 1.0;

      if (char.length !== 1) {
        return {
          success: false,
          error: `Expected single character, got: "${char}"`
        };
      }

      try {
        const outline = fontParser.getGlyphOutline(fontName, char, size);

        return {
          success: true,
          data: {
            char: outline.char,
            width: outline.width,
            height: outline.height,
            contours: outline.contours.map(c => ({
              points: c.points.length,
              isHole: c.isHole
            })),
            totalPoints: outline.contours.reduce((sum, c) => sum + c.points.length, 0),
            bounds: outline.bounds
          }
        };
      } catch (error) {
        return {
          success: false,
          error: String(error)
        };
      }
    }
  },

  {
    action: 'text',
    description: 'Get outlines for a text string',
    usage: 'text.text <string> font=<name> [size=<size>] [spacing=<spacing>]',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const text = getArg(cmd, 0);
      if (!text) {
        return { success: false, error: 'Text string required' };
      }

      const fontName = cmd.options.font;
      if (!fontName) {
        return { success: false, error: 'Font name required (use font=...)' };
      }

      const size = cmd.options.size ? parseFloat(cmd.options.size) : 1.0;
      const spacing = cmd.options.spacing ? parseFloat(cmd.options.spacing) : 0.0;

      try {
        const outlines = await fontParser.getTextOutlines(fontName, text, size, spacing);

        return {
          success: true,
          data: {
            text,
            glyphs: outlines.length,
            totalContours: outlines.reduce((sum: number, o) => sum + o.contours.length, 0),
            totalPoints: outlines.reduce((sum: number, o) =>
              sum + o.contours.reduce((s: number, c) => s + c.points.length, 0), 0
            ),
            width: outlines.length > 0 ?
              outlines[outlines.length - 1].bounds.xMax : 0,
            outlines: outlines.map(o => ({
              char: o.char,
              width: o.width,
              contours: o.contours.length,
              bounds: o.bounds
            }))
          }
        };
      } catch (error) {
        return {
          success: false,
          error: String(error)
        };
      }
    }
  }
];

/**
 * Text and font commands namespace
 */
export const textNamespace: CommandNamespace = {
  name: 'text',
  description: 'Font loading and glyph outline extraction',
  handlers
};
