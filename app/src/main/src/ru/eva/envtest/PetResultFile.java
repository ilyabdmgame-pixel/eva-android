package ru.eva.envtest;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import java.io.*;
import java.util.Locale;

/** One read-only URI grant, issued when the owner opens a task's result. */
public final class PetResultFile extends ContentProvider {
    @Override public boolean onCreate(){return true;}

    static File result(String name)throws FileNotFoundException{
        try{
            File root=new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),"Codex").getCanonicalFile();
            File file=new File(name).getCanonicalFile();
            if(file.getPath().startsWith(root.getPath()+File.separator)&&file.isFile()&&file.canRead())return file;
        }catch(IOException|SecurityException ignored){}
        throw new FileNotFoundException("Файл недоступен");
    }
    static void view(Context context,String name)throws FileNotFoundException{
        File file=result(name);
        Uri uri=new Uri.Builder().scheme("content").authority(context.getPackageName()+".petresult")
            .appendPath(file.getAbsolutePath()).build();
        Intent open=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime(file));
        open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(Intent.createChooser(open,"Открыть результат"));
    }
    private File file(Uri uri)throws FileNotFoundException{
        if(uri.getPathSegments().size()!=1)throw new FileNotFoundException();
        return result(uri.getLastPathSegment());
    }
    private static String mime(File file){
        String name=file.getName();int dot=name.lastIndexOf('.');
        String type=dot<0?null:MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot+1).toLowerCase(Locale.ROOT));
        return type==null?"application/octet-stream":type;
    }
    @Override public String getType(Uri uri){try{return mime(file(uri));}catch(FileNotFoundException e){return null;}}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
        if(!"r".equals(mode))throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){
        String[] columns=projection!=null?projection:new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE};
        MatrixCursor cursor=new MatrixCursor(columns);
        try{
            File f=file(uri);
            MatrixCursor.RowBuilder row=cursor.newRow();
            for(String c:columns)row.add(OpenableColumns.DISPLAY_NAME.equals(c)?f.getName():OpenableColumns.SIZE.equals(c)?f.length():null);
        }catch(FileNotFoundException ignored){}
        return cursor;
    }
    @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
    @Override public int update(Uri u,ContentValues v,String s,String[] args){throw new UnsupportedOperationException();}
    @Override public int delete(Uri u,String s,String[] args){throw new UnsupportedOperationException();}
}
