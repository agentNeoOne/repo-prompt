#!/usr/bin/env node
import { program } from 'commander';
import { glob } from 'glob';
import { readFileSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import clipboard from 'clipboardy';
import ignore from 'ignore';
const VERSION = '0.1.0';
// Default patterns to always ignore
const DEFAULT_IGNORES = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.next/**',
    '__pycache__/**',
    '*.pyc',
    '.DS_Store',
    'Thumbs.db',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '*.min.js',
    '*.min.css',
    '*.map',
    '.env*',
    '*.log',
];
// Binary/large file extensions to skip
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
    '.mp3', '.mp4', '.wav', '.webm', '.ogg',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib',
    '.ttf', '.otf', '.woff', '.woff2',
    '.sqlite', '.db',
]);
function parseSize(size) {
    const match = size.match(/^(\d+)(k|m|kb|mb)?$/i);
    if (!match)
        return 100 * 1024; // default 100KB
    const num = parseInt(match[1]);
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'm' || unit === 'mb')
        return num * 1024 * 1024;
    if (unit === 'k' || unit === 'kb')
        return num * 1024;
    return num;
}
function isBinary(filepath) {
    const ext = filepath.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    return BINARY_EXTENSIONS.has(ext);
}
function buildTree(files, basePath) {
    const tree = {};
    for (const file of files) {
        const parts = file.split('/');
        let current = tree;
        for (const part of parts) {
            if (!current[part])
                current[part] = {};
            current = current[part];
        }
    }
    function render(node, prefix = '') {
        const entries = Object.keys(node).sort((a, b) => {
            const aIsDir = Object.keys(node[a]).length > 0;
            const bIsDir = Object.keys(node[b]).length > 0;
            if (aIsDir !== bIsDir)
                return aIsDir ? -1 : 1;
            return a.localeCompare(b);
        });
        const lines = [];
        entries.forEach((name, i) => {
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';
            const isDir = Object.keys(node[name]).length > 0;
            lines.push(prefix + connector + name + (isDir ? '/' : ''));
            if (isDir) {
                lines.push(...render(node[name], prefix + childPrefix));
            }
        });
        return lines;
    }
    return render(tree).join('\n');
}
async function main() {
    program
        .name('repo-prompt')
        .description('Generate LLM-ready prompts from your codebase')
        .version(VERSION)
        .argument('[patterns...]', 'File patterns to include (glob syntax)', ['**/*'])
        .option('-o, --output <file>', 'Write to file instead of stdout')
        .option('-c, --clipboard', 'Copy to clipboard', true)
        .option('--no-clipboard', 'Do not copy to clipboard')
        .option('-i, --include <patterns...>', 'Additional include patterns')
        .option('-e, --exclude <patterns...>', 'Additional exclude patterns')
        .option('-m, --max-size <size>', 'Max file size (e.g., 50k, 1m)', '100k')
        .option('-t, --tree', 'Include directory tree', true)
        .option('--no-tree', 'Exclude directory tree')
        .option('-p, --prompt <text>', 'Add a system/task prompt at the start')
        .option('-x, --xml', 'Use XML tags for file blocks', false)
        .parse();
    const patterns = program.args.length ? program.args : ['**/*'];
    const options = program.opts();
    const basePath = resolve('.');
    const maxSize = parseSize(options.maxSize || '100k');
    // Load .gitignore if exists
    const ig = ignore();
    ig.add(DEFAULT_IGNORES);
    if (options.exclude) {
        ig.add(options.exclude);
    }
    const gitignorePath = join(basePath, '.gitignore');
    if (existsSync(gitignorePath)) {
        const gitignore = readFileSync(gitignorePath, 'utf-8');
        ig.add(gitignore);
    }
    // Find all matching files
    const allPatterns = [...patterns, ...(options.include || [])];
    const files = [];
    for (const pattern of allPatterns) {
        const matches = await glob(pattern, {
            cwd: basePath,
            nodir: true,
            dot: false,
        });
        files.push(...matches);
    }
    // Filter and dedupe
    const uniqueFiles = [...new Set(files)]
        .filter(f => !ig.ignores(f))
        .filter(f => !isBinary(f))
        .filter(f => {
        try {
            const stat = statSync(join(basePath, f));
            return stat.size <= maxSize;
        }
        catch {
            return false;
        }
    })
        .sort();
    if (uniqueFiles.length === 0) {
        console.error(chalk.yellow('No files matched the criteria.'));
        process.exit(1);
    }
    // Build output
    const parts = [];
    // Optional prompt
    if (options.prompt) {
        parts.push(options.prompt);
        parts.push('');
    }
    // Tree
    if (options.tree) {
        parts.push('## Project Structure\n');
        parts.push('```');
        parts.push(buildTree(uniqueFiles, basePath));
        parts.push('```');
        parts.push('');
    }
    // Files
    parts.push('## Files\n');
    for (const file of uniqueFiles) {
        const content = readFileSync(join(basePath, file), 'utf-8');
        const ext = file.match(/\.([^.]+)$/)?.[1] || '';
        if (options.xml) {
            parts.push(`<file path="${file}">`);
            parts.push(content.trimEnd());
            parts.push('</file>');
        }
        else {
            parts.push(`### ${file}\n`);
            parts.push('```' + ext);
            parts.push(content.trimEnd());
            parts.push('```');
        }
        parts.push('');
    }
    const output = parts.join('\n').trimEnd();
    // Output
    if (options.output) {
        const { writeFileSync } = await import('fs');
        writeFileSync(options.output, output);
        console.error(chalk.green(`✓ Written to ${options.output}`));
    }
    else {
        console.log(output);
    }
    if (options.clipboard) {
        try {
            await clipboard.write(output);
            console.error(chalk.green(`✓ Copied to clipboard (${uniqueFiles.length} files, ${(output.length / 1024).toFixed(1)}KB)`));
        }
        catch (e) {
            console.error(chalk.yellow('Could not copy to clipboard'));
        }
    }
}
main().catch(console.error);
