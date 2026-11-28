package ru.eva.envtest;

import java.io.*;
import java.util.regex.Pattern;

/** The native renderer can open only the immutable output for its currently selected slot. */
final class CharacterFiles {
    private static final Pattern REVISION=Pattern.compile("[0-9a-f]{64}");
    private final File sandbox;
    final File models;
    CharacterFiles(File filesDir) {
        sandbox=filesDir;
        models=new File(filesDir,"rootfs/root/.config/eva/appearance/models");
    }
    static boolean revision(String value){return value!=null&&REVISION.matcher(value).matches();}
    File slots()throws IOException{return inside("slots.json");}
    private File inside(String relative)throws IOException{
        File base=new File(sandbox.getCanonicalFile(),"rootfs/root/.config/eva/appearance/models");
        File target=new File(base,relative);
        if(!target.equals(target.getCanonicalFile()))throw new FileNotFoundException();
        return target;
    }
    InputStream open(String slot,String selected,String hash,String asset)throws IOException{
        boolean room="room".equals(slot)&&("room.mesh".equals(asset)||"atlas.png".equals(asset));
        boolean pet="pet".equals(slot)&&"poses.png".equals(asset);
        if(!(room||pet)||!revision(hash)||!hash.equals(selected))throw new FileNotFoundException();
        File file=inside(hash+"/"+asset);
        long max=asset.equals("room.mesh")?6L*1024*1024:32L*1024*1024;
        if(!file.isFile()||file.length()<=0||file.length()>max)throw new FileNotFoundException();
        return new BufferedInputStream(new FileInputStream(file));
    }
}
