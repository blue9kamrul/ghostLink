// Recursively reads a FileSystemEntry (File or Directory)
export async function parseEntry(entry, path = '') {
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file((file) => {
                // Attach the relative path so we can reconstruct the folder structure later
                file.fullPath = path + file.name;
                resolve([file]);
            });
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
            dirReader.readEntries(async (entries) => {
                let files = [];
                // Recursively parse all entries inside this directory
                for (let i = 0; i < entries.length; i++) {
                    const nestedFiles = await parseEntry(entries[i], path + entry.name + '/');
                    files = files.concat(nestedFiles);
                }
                resolve(files);
            });
        });
    }
    return [];
}

// Processes the raw drop event
export async function handleDroppedItems(dataTransfer) {
    const items = dataTransfer.items;
    let allFiles = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                const files = await parseEntry(entry);
                allFiles = allFiles.concat(files);
            }
        }
    }
    return allFiles;
}