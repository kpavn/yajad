/*jslint nomen: true, node: true, es5: true, todo:true */
"use strict";

var fs = require("fs"),
    argv = require("optimist").argv;

console.log("Parsing file " + argv.file);

var BStream = (function () {
	function BStream(data) {
		this.buffer = data;
		this.curIdx = 0;
	}

	BStream.prototype.nextU = function () {
		var result = this.buffer.readUInt8(this.curIdx);
		this.curIdx += 1;
		return result;
	};

	BStream.prototype.nextU2 = function () {
		var result = this.buffer.readUInt16BE(this.curIdx);
		this.curIdx += 2;
		return result;
	};

	BStream.prototype.nextU4 = function () {
		var result = this.buffer.readUInt32BE(this.curIdx);
		this.curIdx += 4;
		return result;
	};

	return BStream;
}());

function validateCPool(constPool) {
	return null;
}

// data - raw Buffer
function parseClassFile(data) {
	var classFileData = {},
	    bs = new BStream(data),
	    idx = 0,
	    cp_tag = 0,
	    cp_data,
	    str_idx;

	// 0. check class file signature
	if (bs.nextU4() !== 0xCAFEBABE) {
		console.log("Invalid class file format");
		return;
	}

	classFileData.magic = 0xCAFEBABE;

	// 1. check required jvm version
	classFileData.minor_version = bs.nextU2();
	classFileData.major_version = bs.nextU2();

	if (classFileData.major_version >= 45) {
		classFileData.jvm_version = "1." + (classFileData.major_version - 44);
	}

	console.log("Required vm: " + classFileData.jvm_version);

	// 2. Constant pool parsing
	classFileData.constant_pool_count = bs.nextU2();
	classFileData.constant_pool = [];

	idx = 1;

	while (idx <= classFileData.constant_pool_count - 1) {
		cp_tag = bs.nextU();
		cp_data = {
			'cp_tag': cp_tag,
			'cp_idx': idx
		};
		switch (cp_tag) {
		case 7:
			cp_data.cp_type = "CONSTANT_Class";
			cp_data.name_index = bs.nextU2();
			break;
		case 9:
			cp_data.cp_type = "CONSTANT_Fieldref";
			cp_data.class_index = bs.nextU2();
			cp_data.name_and_type_index = bs.nextU2();
			break;
		case 10:
			cp_data.cp_type = "CONSTANT_Methodref";
			cp_data.class_index = bs.nextU2();
			cp_data.name_and_type_index = bs.nextU2();
			break;
		case 11:
			cp_data.cp_type = "CONSTANT_InterfaceMethodref";
			cp_data.class_index = bs.nextU2();
			cp_data.name_and_type_index = bs.nextU2();
			break;
		case 8:
			cp_data.cp_type = "CONSTANT_String";
			cp_data.string_index = bs.nextU2();
			break;
		case 3:
			cp_data.cp_type = "CONSTANT_Integer";
			cp_data.bytes = bs.nextU4();
			break;
		case 4:
			cp_data.cp_type = "CONSTANT_Float";
			cp_data.bytes = bs.nextU4();
			break;
		case 6:
			cp_data.cp_type = "CONSTANT_Double";
			cp_data.high_bytes = bs.nextU4();
			cp_data.low_bytes = bs.nextU4();
			break;
		case 12:
			cp_data.cp_type = "CONSTANT_NameAndType";
			cp_data.name_index = bs.nextU2();
			cp_data.descriptor_index = bs.nextU2();
			break;
		case 1:
			cp_data.cp_type = "CONSTANT_Utf8";
			cp_data.length = bs.nextU2();
			cp_data.bytes = [];
			str_idx = 0;
			while (str_idx < cp_data.length) {
				cp_data.bytes[str_idx] = bs.nextU();
				str_idx += 1;
			}
			break;
		case 15:
			cp_data.cp_type = "CONSTANT_MethodHandle";
			cp_data.reference_kind = bs.nextU2();
			cp_data.reference_index = bs.nextU2();
			break;
		case 16:
			cp_data.cp_type = "CONSTANT_MethodType";
			cp_data.descriptor_index = bs.nextU2();
			break;
		case 18:
			cp_data.cp_type = "CONSTANT_InvokeDynamic";
			cp_data.bootstrap_method_attr_index = bs.nextU2();
			cp_data.name_and_type_index = bs.nextU2();
			break;

		default:
			cp_data.cp_type = "CONSTANT_Unknown";
			break;
		}

		classFileData.constant_pool[idx - 1] = cp_data;

		idx += 1;
	}

	// TODO add validation logic
	validateCPool(classFileData.constant_pool);

	classFileData.access_flags = bs.nextU2();
	classFileData.this_class = bs.nextU2();
	classFileData.super_class = bs.nextU2();
	classFileData.interface_count = bs.nextU2();
	classFileData.interfaces = [];

	idx = 0;

	while (idx < classFileData.interface_count) {
		classFileData.interfaces[idx] = bs.nextU2();
	}

	classFileData.fields_count = bs.nextU2();

	console.log(classFileData);

	// TODO - throw prepared data via EventEmitter
	return classFileData;
}

fs.readFile(argv.file, function (err, data) {
	if (err) {
		console.error(err);
	} else {
		// work with raw bytes array
		return parseClassFile(data);
	}
});

