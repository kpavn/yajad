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

function decodeAccessFlags(flags, type) {
	var results = [],
	    masks = [
			{b: 0x0001, m: "ACC_PUBLIC", n: "Class, Field, Method"},
			{b: 0x0002, m: "ACC_PRIVATE", n: "Field, Method"},
			{b: 0x0004, m: "ACC_PROTECTED", n: "Field, Method"},
			{b: 0x0002, m: "ACC_STATIC", n: "Field, Method"},
			{b: 0x0010, m: "ACC_FINAL", n: "Class, Field, Method"},
			{b: 0x0020, m: "ACC_SUPER", n: "Class, Field"},
			{b: 0x0020, m: "ACC_SYNCHRONIZED", n: "Method"},
			{b: 0x0040, m: "ACC_VOLATILE", n: "Field"},
			{b: 0x0040, m: "ACC_BRIDGE", n: "Method"},
			{b: 0x0080, m: "ACC_TRANSIENT", n: "Field"},
			{b: 0x0080, m: "ACC_VARARGS", n: "Method"},
			{b: 0x0100, m: "ACC_NATIVE", n: "Method"},
			{b: 0x0200, m: "ACC_INTERFACE", n: "Class, Field"},
			{b: 0x0400, m: "ACC_ABSTRACT", n: "Class, Field, Method"},
			{b: 0x0800, m: "ACC_STRICT", n: "Method"},
			{b: 0x1000, m: "ACC_SYNTHETIC", n: "Class, Field"},
			{b: 0x2000, m: "ACC_ANNOTATION", n: "Class, Field"},
			{b: 0x4000, m: "ACC_ENUM", n: "Class, Field"}
	    ];

	masks.forEach(function (m) {
		if ((flags & m.b > 0) && (m.n.indexOf(type) !== -1)) {
			results.push(m.m);
		}
	});

	return results;
}

function parseCPool(bs, classFileData) {
	var idx = 0,
	    str_idx = 0,
	    cp_tag = 0,
	    cp_data = {};

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
		case 5:
			cp_data.cp_type = "CONSTANT_Long";
			cp_data.high_bytes = bs.nextU4();
			cp_data.low_bytes = bs.nextU4();
			idx += 1;
			break;
		case 6:
			cp_data.cp_type = "CONSTANT_Double";
			cp_data.high_bytes = bs.nextU4();
			cp_data.low_bytes = bs.nextU4();
			idx += 1;
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
			for (str_idx = 0; str_idx < cp_data.length; str_idx += 1) {
				cp_data.bytes.push(bs.nextU());
			}
			cp_data.str = new Buffer(cp_data.bytes).toString("utf8");
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

		classFileData.constant_pool.push(cp_data);

		idx += 1;
	}
}

function parseAttributes(bs, classFileData) {
	var idx = 0,
	    idx2 = 0,
	    attr_info = {};

	classFileData.attributes_count = bs.nextU2();
	classFileData.attributes = [];

	for (idx = 0; idx < classFileData.attributes_count; idx += 1) {
		attr_info = {};

		attr_info.attribute_name_index = bs.nextU2();
		attr_info.attribute_length = bs.nextU4();
		attr_info.info = [];

		for (idx2 = 0; idx2 < attr_info.attribute_length; idx2 += 1) {
			attr_info.info.push(bs.nextU());
		}

		classFileData.attributes.push(attr_info);
	}

	return;
}

function parseFields(bs, classFileData) {
	var idx = 0,
	    field_info = {};

	classFileData.fields_count = bs.nextU2();
	classFileData.fields = [];

	for (idx = 0; idx < classFileData.fields_count; idx += 1) {
		field_info = {};
		field_info.access_flags = bs.nextU2();
		field_info.access_flags_decoded = decodeAccessFlags(field_info.access_flags, "Field");
		field_info.name_index = bs.nextU2();
		field_info.name_decoded = classFileData.constant_pool[field_info.name_index].str;
		field_info.desciptor_index = bs.nextU2();
		parseAttributes(bs, field_info);
		classFileData.fields.push(field_info);
	}
}

function parseMethods(bs, classFileData) {
	var idx = 0,
	    method_info = {};

	classFileData.methods_count = bs.nextU2();
	classFileData.methods = [];

	for (idx = 0; idx < classFileData.methods_count; idx += 1) {
		method_info = {};
		method_info.access_flags = bs.nextU2();
		method_info.access_flags_decoded = decodeAccessFlags(method_info.access_flags, "Method");
		method_info.name_index = bs.nextU2();
		method_info.name_decoded = classFileData.constant_pool[method_info.name_index].str;
		method_info.desciptor_index = bs.nextU2();
		parseAttributes(bs, method_info);

		classFileData.methods.push(method_info);
	}

	return;
}

// data - raw Buffer
// TODO - split to small pieces
function parseClassFile(data) {
	var classFileData = {},
	    bs = new BStream(data),
	    idx = 0;

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

	parseCPool(bs, classFileData);

	// TODO add validation logic
	validateCPool(classFileData.constant_pool);

	classFileData.access_flags = bs.nextU2();
	classFileData.access_flags_decoded = decodeAccessFlags(classFileData.access_flags, "Class");

	classFileData.this_class = bs.nextU2();
	classFileData.super_class = bs.nextU2();
	classFileData.interface_count = bs.nextU2();
	classFileData.interfaces = [];

	for (idx = 0; idx < classFileData.interface_count; idx += 1) {
		classFileData.interfaces.push(bs.nextU2());
	}

	parseFields(bs, classFileData);

	parseMethods(bs, classFileData);

	parseAttributes(bs, classFileData);

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

