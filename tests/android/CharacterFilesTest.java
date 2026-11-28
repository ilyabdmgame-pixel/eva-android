package ru.eva.envtest;

import java.io.*;
import java.nio.file.*;
import java.util.Comparator;
import java.util.stream.Stream;

public final class CharacterFilesTest {
    static void missing(CharacterFiles files,String slot,String selected,String id,String asset)throws IOException{
        try(InputStream ignored=files.open(slot,selected,id,asset)){throw new AssertionError("Unexpected asset");}
        catch(FileNotFoundException expected){}
    }
    public static void main(String[] args)throws Exception{
        Path sandbox=Files.createTempDirectory("eva-native-model-");
        String id="a".repeat(64),other="b".repeat(64);
        CharacterFiles files=new CharacterFiles(sandbox.toFile());
        try{
            Path folder=Files.createDirectories(files.models.toPath().resolve(id));
            for(String asset:new String[]{"room.mesh","atlas.png","poses.png","model.glb"})
                Files.write(folder.resolve(asset),new byte[]{19});
            for(String asset:new String[]{"room.mesh","atlas.png"}){
                try(InputStream in=files.open("room",id,id,asset)){if(in.read()!=19)throw new AssertionError();}
                missing(files,"pet",id,id,asset);missing(files,"room",other,id,asset);
                missing(files,"room",id,"../"+id,asset);
            }
            try(InputStream in=files.open("pet",id,id,"poses.png")){if(in.read()!=19)throw new AssertionError();}
            for(String asset:new String[]{"poses.png","model.glb","../slots.json","room.mesh/../model.glb"})
                missing(files,"room",id,id,asset);
            Files.delete(folder.resolve("atlas.png"));
            Files.createSymbolicLink(folder.resolve("atlas.png"),folder.resolve("model.glb"));
            missing(files,"room",id,id,"atlas.png");
            Files.delete(folder.resolve("poses.png"));Files.createFile(folder.resolve("poses.png"));
            missing(files,"pet",id,id,"poses.png");
            if(CharacterFiles.revision("A".repeat(64))||CharacterFiles.revision(id+"0")||CharacterFiles.revision(null))throw new AssertionError();
        }finally{
            try(Stream<Path> paths=Files.walk(sandbox)){
                for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.delete(path);
            }
        }
        System.out.println("Native model streams enforce selected slot, exact immutable filenames and sandbox boundaries.");
    }
}
