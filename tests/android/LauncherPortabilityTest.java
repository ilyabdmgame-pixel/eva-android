package ru.eva.envtest;

import java.util.HashSet;
import java.util.Set;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;

public final class LauncherPortabilityTest {
    private static void check(boolean ok){if(!ok)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        String stock="com.hihonor.android.launcher",pixel="com.google.android.apps.nexuslauncher",eva="org.evaassistant.app";
        check(PetLauncherWorkspace.matches(pixel,pixel,eva));
        check(!PetLauncherWorkspace.matches(pixel,stock,eva)&&!PetLauncherWorkspace.matches(eva,eva,eva));
        check(!PetLauncherWorkspace.matches(null,pixel,eva)&&!PetLauncherWorkspace.matches(pixel,null,eva));
        check(PetLauncherWorkspace.workspaceRank(pixel+":id/workspace",null)==3);
        check(PetLauncherWorkspace.workspaceRank("oem.launcher:id/home_workspace",null)==2);
        check(PetLauncherWorkspace.workspaceRank("", "com.android.launcher3.Workspace")==1);
        check(PetLauncherWorkspace.workspaceRank("com.example:id/content",null)==0);
        check(PetLauncherWorkspace.support(null,null)==0);
        check(PetLauncherWorkspace.support("oem.launcher:id/folder_icon",null)==PetHomeMap.FOLDER);
        check(PetLauncherWorkspace.support("","com.android.launcher3.LauncherAppWidgetHostView")==PetHomeMap.WIDGET);
        check(PetLauncherWorkspace.support("","com.android.launcher3.folder.FolderIcon")==PetHomeMap.FOLDER);
        check(PetLauncherWorkspace.layoutKey(stock,0).equals("honor_home"));
        check(PetLauncherWorkspace.layoutKey(stock,3).equals("honor_home_rotation_3"));
        check(PetLauncherWorkspace.manualKey(stock,2,4).equals("manual_v1_r2_p4"));
        check(PetLauncherWorkspace.manualKey(pixel,0,-1)==null&&PetLauncherWorkspace.manualKey(null,0,1)==null);
        check(!PetLauncherWorkspace.manualKey(pixel,0,1).equals(PetLauncherWorkspace.manualKey(stock,0,1)));
        check(!PetLauncherWorkspace.layoutKey(pixel,0).equals(PetLauncherWorkspace.layoutKey(pixel,1)));
        Set<String> optional=new HashSet<>();
        var factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
        var manifest=factory.newDocumentBuilder().parse("app/src/main/AndroidManifest.xml");
        var features=manifest.getElementsByTagName("uses-feature");
        String ns="http://schemas.android.com/apk/res/android";
        for(int i=0;i<features.getLength();i++){Element feature=(Element)features.item(i);
            if("false".equals(feature.getAttributeNS(ns,"required")))optional.add(feature.getAttributeNS(ns,"name"));}
        check(optional.containsAll(Set.of("android.hardware.camera","android.hardware.camera.autofocus",
            "android.hardware.telephony","android.hardware.microphone","android.software.app_widgets")));
        System.out.println("Third-party launcher geometry, HONOR migration, and optional hardware manifest verified.");
    }
}
