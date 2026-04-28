export interface MimeMapping {
  mime: string;
  category: "image" | "audio" | "video" | "text" | "application" | "font" | "model" | "multipart";
  extensions: string[];
}

export const mimeMappings: MimeMapping[] = [
  {
    "mime": "text/plain",
    "category": "text",
    "extensions": [
      "txt",
      "text",
      "conf",
      "def",
      "log",
      "ini"
    ]
  },
  {
    "mime": "text/html",
    "category": "text",
    "extensions": [
      "html",
      "htm"
    ]
  },
  {
    "mime": "text/css",
    "category": "text",
    "extensions": [
      "css"
    ]
  },
  {
    "mime": "text/csv",
    "category": "text",
    "extensions": [
      "csv"
    ]
  },
  {
    "mime": "text/xml",
    "category": "text",
    "extensions": [
      "xml"
    ]
  },
  {
    "mime": "text/markdown",
    "category": "text",
    "extensions": [
      "md",
      "markdown"
    ]
  },
  {
    "mime": "text/javascript",
    "category": "text",
    "extensions": [
      "js",
      "mjs"
    ]
  },
  {
    "mime": "text/calendar",
    "category": "text",
    "extensions": [
      "ics"
    ]
  },
  {
    "mime": "text/tab-separated-values",
    "category": "text",
    "extensions": [
      "tsv"
    ]
  },
  {
    "mime": "text/vcard",
    "category": "text",
    "extensions": [
      "vcf"
    ]
  },
  {
    "mime": "application/json",
    "category": "application",
    "extensions": [
      "json"
    ]
  },
  {
    "mime": "application/ld+json",
    "category": "application",
    "extensions": [
      "jsonld"
    ]
  },
  {
    "mime": "application/xml",
    "category": "application",
    "extensions": [
      "xml",
      "xsl"
    ]
  },
  {
    "mime": "application/pdf",
    "category": "application",
    "extensions": [
      "pdf"
    ]
  },
  {
    "mime": "application/zip",
    "category": "application",
    "extensions": [
      "zip"
    ]
  },
  {
    "mime": "application/gzip",
    "category": "application",
    "extensions": [
      "gz"
    ]
  },
  {
    "mime": "application/x-tar",
    "category": "application",
    "extensions": [
      "tar"
    ]
  },
  {
    "mime": "application/x-7z-compressed",
    "category": "application",
    "extensions": [
      "7z"
    ]
  },
  {
    "mime": "application/x-rar-compressed",
    "category": "application",
    "extensions": [
      "rar"
    ]
  },
  {
    "mime": "application/msword",
    "category": "application",
    "extensions": [
      "doc"
    ]
  },
  {
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "category": "application",
    "extensions": [
      "docx"
    ]
  },
  {
    "mime": "application/vnd.ms-excel",
    "category": "application",
    "extensions": [
      "xls"
    ]
  },
  {
    "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "category": "application",
    "extensions": [
      "xlsx"
    ]
  },
  {
    "mime": "application/vnd.ms-powerpoint",
    "category": "application",
    "extensions": [
      "ppt"
    ]
  },
  {
    "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "category": "application",
    "extensions": [
      "pptx"
    ]
  },
  {
    "mime": "application/rtf",
    "category": "application",
    "extensions": [
      "rtf"
    ]
  },
  {
    "mime": "application/sql",
    "category": "application",
    "extensions": [
      "sql"
    ]
  },
  {
    "mime": "application/graphql",
    "category": "application",
    "extensions": [
      "graphql"
    ]
  },
  {
    "mime": "application/wasm",
    "category": "application",
    "extensions": [
      "wasm"
    ]
  },
  {
    "mime": "application/octet-stream",
    "category": "application",
    "extensions": [
      "bin",
      "exe",
      "dll"
    ]
  },
  {
    "mime": "application/x-www-form-urlencoded",
    "category": "application",
    "extensions": [
      "urlencoded"
    ]
  },
  {
    "mime": "application/x-sh",
    "category": "application",
    "extensions": [
      "sh"
    ]
  },
  {
    "mime": "application/x-httpd-php",
    "category": "application",
    "extensions": [
      "php"
    ]
  },
  {
    "mime": "application/java-archive",
    "category": "application",
    "extensions": [
      "jar"
    ]
  },
  {
    "mime": "application/vnd.apple.installer+xml",
    "category": "application",
    "extensions": [
      "mpkg"
    ]
  },
  {
    "mime": "application/x-bzip",
    "category": "application",
    "extensions": [
      "bz"
    ]
  },
  {
    "mime": "application/x-bzip2",
    "category": "application",
    "extensions": [
      "bz2"
    ]
  },
  {
    "mime": "application/x-cdf",
    "category": "application",
    "extensions": [
      "cdf"
    ]
  },
  {
    "mime": "application/x-font-ttf",
    "category": "application",
    "extensions": [
      "ttf"
    ]
  },
  {
    "mime": "application/x-font-otf",
    "category": "application",
    "extensions": [
      "otf"
    ]
  },
  {
    "mime": "application/x-font-woff",
    "category": "application",
    "extensions": [
      "woff"
    ]
  },
  {
    "mime": "application/x-font-woff2",
    "category": "application",
    "extensions": [
      "woff2"
    ]
  },
  {
    "mime": "application/vnd.amazon.ebook",
    "category": "application",
    "extensions": [
      "azw"
    ]
  },
  {
    "mime": "application/epub+zip",
    "category": "application",
    "extensions": [
      "epub"
    ]
  },
  {
    "mime": "application/xslt+xml",
    "category": "application",
    "extensions": [
      "xslt"
    ]
  },
  {
    "mime": "application/vnd.sqlite3",
    "category": "application",
    "extensions": [
      "sqlite"
    ]
  },
  {
    "mime": "application/x-yaml",
    "category": "application",
    "extensions": [
      "yaml",
      "yml"
    ]
  },
  {
    "mime": "application/toml",
    "category": "application",
    "extensions": [
      "toml"
    ]
  },
  {
    "mime": "application/x-ndjson",
    "category": "application",
    "extensions": [
      "ndjson"
    ]
  },
  {
    "mime": "image/png",
    "category": "image",
    "extensions": [
      "png"
    ]
  },
  {
    "mime": "image/jpeg",
    "category": "image",
    "extensions": [
      "jpg",
      "jpeg"
    ]
  },
  {
    "mime": "image/gif",
    "category": "image",
    "extensions": [
      "gif"
    ]
  },
  {
    "mime": "image/webp",
    "category": "image",
    "extensions": [
      "webp"
    ]
  },
  {
    "mime": "image/avif",
    "category": "image",
    "extensions": [
      "avif"
    ]
  },
  {
    "mime": "image/svg+xml",
    "category": "image",
    "extensions": [
      "svg"
    ]
  },
  {
    "mime": "image/bmp",
    "category": "image",
    "extensions": [
      "bmp"
    ]
  },
  {
    "mime": "image/tiff",
    "category": "image",
    "extensions": [
      "tif",
      "tiff"
    ]
  },
  {
    "mime": "image/x-icon",
    "category": "image",
    "extensions": [
      "ico"
    ]
  },
  {
    "mime": "image/heic",
    "category": "image",
    "extensions": [
      "heic"
    ]
  },
  {
    "mime": "image/heif",
    "category": "image",
    "extensions": [
      "heif"
    ]
  },
  {
    "mime": "image/vnd.microsoft.icon",
    "category": "image",
    "extensions": [
      "ico"
    ]
  },
  {
    "mime": "image/apng",
    "category": "image",
    "extensions": [
      "apng"
    ]
  },
  {
    "mime": "image/jxl",
    "category": "image",
    "extensions": [
      "jxl"
    ]
  },
  {
    "mime": "image/vnd.adobe.photoshop",
    "category": "image",
    "extensions": [
      "psd"
    ]
  },
  {
    "mime": "audio/mpeg",
    "category": "audio",
    "extensions": [
      "mp3"
    ]
  },
  {
    "mime": "audio/wav",
    "category": "audio",
    "extensions": [
      "wav"
    ]
  },
  {
    "mime": "audio/ogg",
    "category": "audio",
    "extensions": [
      "ogg"
    ]
  },
  {
    "mime": "audio/aac",
    "category": "audio",
    "extensions": [
      "aac"
    ]
  },
  {
    "mime": "audio/flac",
    "category": "audio",
    "extensions": [
      "flac"
    ]
  },
  {
    "mime": "audio/webm",
    "category": "audio",
    "extensions": [
      "weba"
    ]
  },
  {
    "mime": "audio/mp4",
    "category": "audio",
    "extensions": [
      "m4a"
    ]
  },
  {
    "mime": "audio/midi",
    "category": "audio",
    "extensions": [
      "mid",
      "midi"
    ]
  },
  {
    "mime": "audio/3gpp",
    "category": "audio",
    "extensions": [
      "3gp"
    ]
  },
  {
    "mime": "audio/opus",
    "category": "audio",
    "extensions": [
      "opus"
    ]
  },
  {
    "mime": "audio/amr",
    "category": "audio",
    "extensions": [
      "amr"
    ]
  },
  {
    "mime": "video/mp4",
    "category": "video",
    "extensions": [
      "mp4"
    ]
  },
  {
    "mime": "video/webm",
    "category": "video",
    "extensions": [
      "webm"
    ]
  },
  {
    "mime": "video/ogg",
    "category": "video",
    "extensions": [
      "ogv"
    ]
  },
  {
    "mime": "video/quicktime",
    "category": "video",
    "extensions": [
      "mov"
    ]
  },
  {
    "mime": "video/x-msvideo",
    "category": "video",
    "extensions": [
      "avi"
    ]
  },
  {
    "mime": "video/x-ms-wmv",
    "category": "video",
    "extensions": [
      "wmv"
    ]
  },
  {
    "mime": "video/x-matroska",
    "category": "video",
    "extensions": [
      "mkv"
    ]
  },
  {
    "mime": "video/mpeg",
    "category": "video",
    "extensions": [
      "mpeg",
      "mpg"
    ]
  },
  {
    "mime": "video/3gpp",
    "category": "video",
    "extensions": [
      "3gp"
    ]
  },
  {
    "mime": "video/3gpp2",
    "category": "video",
    "extensions": [
      "3g2"
    ]
  },
  {
    "mime": "video/x-flv",
    "category": "video",
    "extensions": [
      "flv"
    ]
  },
  {
    "mime": "video/mp2t",
    "category": "video",
    "extensions": [
      "ts"
    ]
  },
  {
    "mime": "font/ttf",
    "category": "font",
    "extensions": [
      "ttf"
    ]
  },
  {
    "mime": "font/otf",
    "category": "font",
    "extensions": [
      "otf"
    ]
  },
  {
    "mime": "font/woff",
    "category": "font",
    "extensions": [
      "woff"
    ]
  },
  {
    "mime": "font/woff2",
    "category": "font",
    "extensions": [
      "woff2"
    ]
  },
  {
    "mime": "font/collection",
    "category": "font",
    "extensions": [
      "ttc"
    ]
  },
  {
    "mime": "model/gltf+json",
    "category": "model",
    "extensions": [
      "gltf"
    ]
  },
  {
    "mime": "model/gltf-binary",
    "category": "model",
    "extensions": [
      "glb"
    ]
  },
  {
    "mime": "model/obj",
    "category": "model",
    "extensions": [
      "obj"
    ]
  },
  {
    "mime": "model/stl",
    "category": "model",
    "extensions": [
      "stl"
    ]
  },
  {
    "mime": "model/3mf",
    "category": "model",
    "extensions": [
      "3mf"
    ]
  },
  {
    "mime": "multipart/form-data",
    "category": "multipart",
    "extensions": [
      "form"
    ]
  },
  {
    "mime": "multipart/byteranges",
    "category": "multipart",
    "extensions": [
      "byteranges"
    ]
  },
  {
    "mime": "multipart/mixed",
    "category": "multipart",
    "extensions": [
      "mixed"
    ]
  },
  {
    "mime": "application/vnd.rar",
    "category": "application",
    "extensions": [
      "rar"
    ]
  },
  {
    "mime": "application/x-iso9660-image",
    "category": "application",
    "extensions": [
      "iso"
    ]
  },
  {
    "mime": "application/postscript",
    "category": "application",
    "extensions": [
      "ps",
      "eps"
    ]
  },
  {
    "mime": "application/x-pkcs12",
    "category": "application",
    "extensions": [
      "p12",
      "pfx"
    ]
  },
  {
    "mime": "application/pkcs8",
    "category": "application",
    "extensions": [
      "p8"
    ]
  },
  {
    "mime": "application/pkix-cert",
    "category": "application",
    "extensions": [
      "cer"
    ]
  },
  {
    "mime": "application/x-pem-file",
    "category": "application",
    "extensions": [
      "pem"
    ]
  },
  {
    "mime": "application/x-der",
    "category": "application",
    "extensions": [
      "der"
    ]
  },
  {
    "mime": "application/vnd.mozilla.xul+xml",
    "category": "application",
    "extensions": [
      "xul"
    ]
  },
  {
    "mime": "application/sparql-query",
    "category": "application",
    "extensions": [
      "rq"
    ]
  },
  {
    "mime": "application/x-latex",
    "category": "application",
    "extensions": [
      "latex"
    ]
  },
  {
    "mime": "application/vnd.oasis.opendocument.text",
    "category": "application",
    "extensions": [
      "odt"
    ]
  },
  {
    "mime": "application/vnd.oasis.opendocument.spreadsheet",
    "category": "application",
    "extensions": [
      "ods"
    ]
  },
  {
    "mime": "application/vnd.oasis.opendocument.presentation",
    "category": "application",
    "extensions": [
      "odp"
    ]
  },
  {
    "mime": "application/vnd.visio",
    "category": "application",
    "extensions": [
      "vsd"
    ]
  },
  {
    "mime": "application/x-msdownload",
    "category": "application",
    "extensions": [
      "msi"
    ]
  },
  {
    "mime": "application/x-apple-diskimage",
    "category": "application",
    "extensions": [
      "dmg"
    ]
  },
  {
    "mime": "application/x-mach-binary",
    "category": "application",
    "extensions": [
      "macho"
    ]
  },
  {
    "mime": "application/x-debian-package",
    "category": "application",
    "extensions": [
      "deb"
    ]
  },
  {
    "mime": "application/x-rpm",
    "category": "application",
    "extensions": [
      "rpm"
    ]
  },
  {
    "mime": "application/vnd.android.package-archive",
    "category": "application",
    "extensions": [
      "apk"
    ]
  },
  {
    "mime": "application/x-redhat-package-manager",
    "category": "application",
    "extensions": [
      "rpm"
    ]
  },
  {
    "mime": "application/vnd.ms-fontobject",
    "category": "application",
    "extensions": [
      "eot"
    ]
  },
  {
    "mime": "application/x-abiword",
    "category": "application",
    "extensions": [
      "abw"
    ]
  },
  {
    "mime": "application/x-freearc",
    "category": "application",
    "extensions": [
      "arc"
    ]
  },
  {
    "mime": "application/x-csh",
    "category": "application",
    "extensions": [
      "csh"
    ]
  },
  {
    "mime": "application/vnd.dart",
    "category": "application",
    "extensions": [
      "dart"
    ]
  },
  {
    "mime": "application/ecmascript",
    "category": "application",
    "extensions": [
      "es"
    ]
  },
  {
    "mime": "application/vnd.google-earth.kml+xml",
    "category": "application",
    "extensions": [
      "kml"
    ]
  },
  {
    "mime": "application/vnd.google-earth.kmz",
    "category": "application",
    "extensions": [
      "kmz"
    ]
  },
  {
    "mime": "application/vnd.lotus-1-2-3",
    "category": "application",
    "extensions": [
      "123"
    ]
  },
  {
    "mime": "application/vnd.ms-access",
    "category": "application",
    "extensions": [
      "mdb"
    ]
  },
  {
    "mime": "application/vnd.ms-project",
    "category": "application",
    "extensions": [
      "mpp"
    ]
  },
  {
    "mime": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    "category": "application",
    "extensions": [
      "ppsx"
    ]
  },
  {
    "mime": "application/x-shockwave-flash",
    "category": "application",
    "extensions": [
      "swf"
    ]
  },
  {
    "mime": "application/vnd.tcpdump.pcap",
    "category": "application",
    "extensions": [
      "pcap"
    ]
  },
  {
    "mime": "application/x-protobuf",
    "category": "application",
    "extensions": [
      "proto"
    ]
  },
  {
    "mime": "application/x-chrome-extension",
    "category": "application",
    "extensions": [
      "crx"
    ]
  },
  {
    "mime": "application/x-x509-ca-cert",
    "category": "application",
    "extensions": [
      "crt"
    ]
  },
  {
    "mime": "application/zstd",
    "category": "application",
    "extensions": [
      "zst"
    ]
  },
  {
    "mime": "application/vnd.iccprofile",
    "category": "application",
    "extensions": [
      "icc"
    ]
  },
  {
    "mime": "application/x-netcdf",
    "category": "application",
    "extensions": [
      "nc"
    ]
  },
  {
    "mime": "application/x-hdf",
    "category": "application",
    "extensions": [
      "hdf"
    ]
  },
  {
    "mime": "application/x-research-info-systems",
    "category": "application",
    "extensions": [
      "ris"
    ]
  },
  {
    "mime": "application/vnd.ms-outlook",
    "category": "application",
    "extensions": [
      "msg"
    ]
  },
  {
    "mime": "application/vnd.apple.keynote",
    "category": "application",
    "extensions": [
      "key"
    ]
  },
  {
    "mime": "application/vnd.apple.numbers",
    "category": "application",
    "extensions": [
      "numbers"
    ]
  },
  {
    "mime": "application/vnd.apple.pages",
    "category": "application",
    "extensions": [
      "pages"
    ]
  },
  {
    "mime": "application/vnd.mapbox-vector-tile",
    "category": "application",
    "extensions": [
      "mvt"
    ]
  },
  {
    "mime": "application/vnd.ms-cab-compressed",
    "category": "application",
    "extensions": [
      "cab"
    ]
  },
  {
    "mime": "application/vnd.wolfram.mathematica",
    "category": "application",
    "extensions": [
      "nb"
    ]
  },
  {
    "mime": "application/vnd.yamaha.hv-script",
    "category": "application",
    "extensions": [
      "hvs"
    ]
  },
  {
    "mime": "application/vnd.yamaha.hv-voice",
    "category": "application",
    "extensions": [
      "hvp"
    ]
  },
  {
    "mime": "application/vnd.yamaha.openscoreformat",
    "category": "application",
    "extensions": [
      "osf"
    ]
  },
  {
    "mime": "application/vnd.yellowriver-custom-menu",
    "category": "application",
    "extensions": [
      "cmp"
    ]
  },
  {
    "mime": "application/x-lua-bytecode",
    "category": "application",
    "extensions": [
      "luac"
    ]
  },
  {
    "mime": "application/x-object",
    "category": "application",
    "extensions": [
      "o"
    ]
  },
  {
    "mime": "application/x-virtualbox-vbox",
    "category": "application",
    "extensions": [
      "vbox"
    ]
  },
  {
    "mime": "application/x-virtualbox-vdi",
    "category": "application",
    "extensions": [
      "vdi"
    ]
  },
  {
    "mime": "application/x-virtualbox-vmdk",
    "category": "application",
    "extensions": [
      "vmdk"
    ]
  },
  {
    "mime": "application/x-virtualbox-ova",
    "category": "application",
    "extensions": [
      "ova"
    ]
  },
  {
    "mime": "application/x-virtualbox-ovf",
    "category": "application",
    "extensions": [
      "ovf"
    ]
  },
  {
    "mime": "text/richtext",
    "category": "text",
    "extensions": [
      "rtx"
    ]
  },
  {
    "mime": "text/uri-list",
    "category": "text",
    "extensions": [
      "uri"
    ]
  },
  {
    "mime": "text/x-python",
    "category": "text",
    "extensions": [
      "py"
    ]
  },
  {
    "mime": "text/x-go",
    "category": "text",
    "extensions": [
      "go"
    ]
  },
  {
    "mime": "text/x-rust",
    "category": "text",
    "extensions": [
      "rs"
    ]
  },
  {
    "mime": "text/x-java-source",
    "category": "text",
    "extensions": [
      "java"
    ]
  },
  {
    "mime": "text/x-c",
    "category": "text",
    "extensions": [
      "c",
      "h"
    ]
  },
  {
    "mime": "text/x-c++",
    "category": "text",
    "extensions": [
      "cpp",
      "hpp"
    ]
  },
  {
    "mime": "text/x-typescript",
    "category": "text",
    "extensions": [
      "ts"
    ]
  },
  {
    "mime": "text/x-tsx",
    "category": "text",
    "extensions": [
      "tsx"
    ]
  },
  {
    "mime": "text/x-shellscript",
    "category": "text",
    "extensions": [
      "bash"
    ]
  },
  {
    "mime": "audio/x-aiff",
    "category": "audio",
    "extensions": [
      "aif",
      "aiff"
    ]
  },
  {
    "mime": "audio/x-ms-wma",
    "category": "audio",
    "extensions": [
      "wma"
    ]
  },
  {
    "mime": "video/x-ms-asf",
    "category": "video",
    "extensions": [
      "asf"
    ]
  },
  {
    "mime": "image/x-xbitmap",
    "category": "image",
    "extensions": [
      "xbm"
    ]
  },
  {
    "mime": "image/x-portable-pixmap",
    "category": "image",
    "extensions": [
      "ppm"
    ]
  },
  {
    "mime": "font/sfnt",
    "category": "font",
    "extensions": [
      "sfnt"
    ]
  }
];
