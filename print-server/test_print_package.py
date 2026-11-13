import base64
import io
import json
import unittest
import zipfile
import server
import print_package


def packet(length=1000, label=32):
    import math
    d=print_package.DOTS_PER_MM; rows=math.ceil(length*d-1e-9);height=rows+math.ceil(label*d-1e-9)
    return {"format":"muusia-surface-strip","version":1,"name":"Paper 1","profile":{"id":print_package.PROFILE_ID,"width":512,"dotsPerMm":d},"geometry":{"stripId":"a","number":1,"printOrder":1,"physicalWidthMm":80,"printableOffsetMm":4.6,"printableWidthMm":70.8,"originalLengthMm":length,"fromMm":0,"toMm":length,"bodyLengthMm":length,"labelLengthMm":label,"bodyRows":rows},"width":512,"height":height,"data":base64.b64encode(bytes(height*64)).decode(),"cut":True,**({"tearAtRow":rows} if label else {})}


def archive(body, extra=None, manifest_patch=None):
    stream=io.BytesIO();name='demo-strip-0001.muusia-strip.json'
    manifest={"format":"muusia-print-package","version":1,"defaultPrintMode":"manual","strips":[{"filename":name,"stripId":"a","number":1,"printOrder":1}]}
    if manifest_patch:manifest.update(manifest_patch)
    with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr(name,json.dumps(body));z.writestr('manifest.json',json.dumps(manifest))
        for key,value in (extra or {}).items():z.writestr(key,value)
    return stream.getvalue()


class PrintPackageTests(unittest.TestCase):
    def test_long_strip_zip_and_selected_file_preserve_scale_pixels_and_internal_cut(self):
        p=packet();out=server.inspect_file('demo-print.zip',archive(p));self.assertEqual(len(out),1)
        self.assertEqual(out[0]['kind'],'strip');self.assertEqual(out[0]['height'],7295);self.assertEqual(out[0]['tearAtRow'],7068);self.assertEqual(out[0]['data'],p['data']);self.assertEqual(out[0]['geometry'],p['geometry'])
        single=server.inspect_file('demo.muusia-strip.json',json.dumps(p).encode());self.assertEqual(single,out)
        encoded=server.escpos_surface_strip(out[0]['height'],base64.b64decode(out[0]['data']),True,out[0]['tearAtRow']);self.assertEqual(encoded.count(b'\x1dV\x42\x00'),1)

    def test_png_export_gets_actionable_workflow_instead_of_oversize_error(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as z:z.writestr('manifest.json',json.dumps({'format':'muusia-surface-strips','version':1}));z.writestr('strip.png',b'not-decoded')
        with self.assertRaisesRegex(ValueError,'Export Print package'):server.inspect_file('surface.zip',stream.getvalue())

    def test_manifest_entries_version_order_and_extra_members_are_validated(self):
        p=packet(100)
        for patch in [{'version':2},{'defaultPrintMode':'consecutive'},{'strips':[]},{'strips':[{'filename':'../bad.muusia-strip.json'}]}]:
            with self.assertRaises(ValueError):server.inspect_file('x.zip',archive(p,manifest_patch=patch))
        with self.assertRaisesRegex(ValueError,'contents'):server.inspect_file('x.zip',archive(p,extra={'junk.txt':'bad'}))
        p['geometry']['printOrder']=2
        with self.assertRaisesRegex(ValueError,'identity'):server.inspect_file('x.zip',archive(p))

    def test_invalid_geometry_calibration_cut_and_margin_bits_are_rejected(self):
        p=packet(100)
        variants=[]
        for key,value in [('physicalWidthMm',100),('bodyRows',1),('bodyLengthMm',99),('toMm',200),('printableWidthMm',90)]:
            q={**p,'geometry':{**p['geometry'],key:value}};variants.append(q)
        variants += [{**p,'profile':{**p['profile'],'dotsPerMm':8}},{**p,'tearAtRow':1},{**p,'tearAtRow':True},{**p,'height':p['height']+1}]
        bits=bytearray(base64.b64decode(p['data']));bits[0]=128;variants.append({**p,'data':base64.b64encode(bits).decode()})
        for q in variants:
            with self.assertRaises(ValueError):print_package.validate_strip_packet(q,server.validate_receipt)

    def test_trim_guards_preserve_body_geometry_and_move_label_cut_after_guards(self):
        p=packet(100);rows=p['geometry']['bodyRows'];p['geometry']['trim']={'leadingRows':22,'trailingRows':22}
        p['height']+=44;p['tearAtRow']+=44;p['data']=base64.b64encode(bytes(p['height']*64)).decode()
        out=server.inspect_file('trim.muusia-strip.json',json.dumps(p).encode())[0]
        self.assertEqual(out['geometry']['bodyRows'],rows);self.assertEqual(out['tearAtRow'],rows+44)
        for trim in [{'leadingRows':21,'trailingRows':22},{'leadingRows':True,'trailingRows':22},None]:
            q={**p,'geometry':{**p['geometry'],'trim':trim}}
            with self.assertRaises(ValueError):print_package.validate_strip_packet(q,server.validate_receipt)
        q={**p,'tearAtRow':rows}
        with self.assertRaises(ValueError):print_package.validate_strip_packet(q,server.validate_receipt)

    def test_legacy_receipt_zip_is_unchanged(self):
        p={'format':'muusia-receipt','version':1,'width':512,'height':1,'data':base64.b64encode(bytes(64)).decode(),'cut':True}
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as z:z.writestr('old.muusia-receipt.json',json.dumps(p))
        result=server.inspect_file('old.zip',stream.getvalue());self.assertEqual(result[0]['height'],1);self.assertNotIn('kind',result[0])

if __name__=='__main__':unittest.main()
