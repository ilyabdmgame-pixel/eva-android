package ru.eva.envtest;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import static ru.eva.envtest.PetWindows.*;

public final class PetWindowsTest {
    private static List<Edge> layer(Edge... parts){return Arrays.asList(parts);}
    private static Edge app(int id,int l,int t,int r,int b){return new Edge(id,APP,l,t,r,b);}
    private static Edge ime(int id,int l,int t,int r,int b){return new Edge(id,IME,l,t,r,b);}
    @SafeVarargs private static List<Edge> edges(List<Edge>... layers){
        return PetWindows.exposed(Arrays.asList(layers),0,60,1080,2100,60);
    }
    private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}

    public static void main(String[] args){
        List<Edge> appBase=layer(app(1,0,0,1080,2190));
        List<Edge> keyboard=layer(ime(50,0,1420,1080,2300));
        List<Edge> result=edges(keyboard,appBase);
        check(result.equals(layer(ime(50,0,1420,1080,2160))),"Keyboard uses actual top edge and viewport bottom");
        check(edges(appBase).isEmpty(),"Hidden keyboard and a fullscreen activity have no edge");
        List<Edge> dialog=layer(app(10,83,600,997,1590));
        check(edges(dialog,appBase).equals(dialog),"Dialog appears in front of its full-screen activity");
        check(edges(appBase,dialog).isEmpty(),"Covered dialog is not retained behind a foreground activity");

        List<Edge> floating=layer(ime(50,234,1050,725,1450));
        List<Edge> window=layer(app(4,120,1300,950,1700));
        result=edges(floating,window,appBase);
        check(result.equals(Arrays.asList(ime(50,234,1050,725,1450),app(4,120,1300,234,1700),
                app(4,725,1300,950,1700))),"Floating keyboard clips only covered portions of an edge");
        List<Edge> halves=layer(ime(50,0,1260,390,1610),ime(50,650,1260,1080,1610));
        check(edges(halves,appBase).equals(halves),"Split IME must preserve the gap");

        List<Edge> rounded=layer(ime(50,206,1000,694,1001),ime(50,200,1001,700,1500));
        result=edges(rounded);
        check(result.size()==1&&result.get(0).t==1000&&result.get(0).b==1500,"An internal band is not a second top edge");
        check(edges(layer(app(1,0,60,1080,1110)),layer(app(2,0,1124,1080,2160)))
                .equals(layer(app(2,0,1124,1080,2160))),"Lower half of split screen creates a real shelf");
        check(edges(layer(new Edge(6,BLOCKER,0,0,1080,2200)),dialog).isEmpty(),"Modal system surface hides background targets");
        check(edges(layer(ime(50,0,0,1080,2160))).isEmpty(),"A fullscreen IME backdrop has no invented edge");
        Edge landscape=ime(51,123,123,2640,1200);
        Edge extract=ime(51,123,123,2640,484),input=ime(51,123,484,2640,1200);
        check(fullLandscapeIme(landscape,123,123,2640,1128),"Fullscreen IME includes the viewport above the nav inset");
        check(!fullLandscapeIme(input,123,123,2640,1128)&&!fullLandscapeIme(keyboard.get(0),0,60,1080,2160),
                "An ordinary keyboard keeps its original upper edge");
        check(extractedKeyboard(landscape,extract,input)==input,"Matching Android frames expose the real keyboard top");
        check(extractedKeyboard(landscape,null,input)==null&&
                extractedKeyboard(landscape,ime(51,123,123,2640,460),input)==null&&
                extractedKeyboard(landscape,extract,ime(51,127,484,2640,1200))==null,
                "Absent, separated or misaligned frames cannot manufacture an inner keyboard shelf");
        List<Edge> coveredApp=layer(app(4,320,338,630,570));
        check(PetWindows.exposed(Arrays.asList(layer(input),layer(landscape),coveredApp),123,123,2517,1005,60)
                .equals(layer(ime(51,123,484,2640,1128))),"Extracted editor area occludes app windows behind the shelf");
        check(PetWindows.exposed(Arrays.asList(layer(landscape),coveredApp),123,123,2517,1005,60).isEmpty(),
                "No verified editor and input leaves the fullscreen IME entirely opaque");
        check(edges(Collections.emptyList()).isEmpty(),"An unavailable window list must clear all supports");
        Edge host=app(44,0,60,1080,2160);
        Edge sheet=panel(44,"design_bottom_sheet","android.widget.FrameLayout",host,16,1450,1064,2160,3);
        Edge nav=panel(44,"bottom_navigation","com.google.android.material.bottomnavigation.BottomNavigationView",
                host,0,1992,1080,2160,3);
        check(sheet!=null&&sheet.id<0&&nav!=null&&sheet.id!=nav.id&&sheet.t==1450,"Durable independent panel roles");
        check(panel(44,"design_bottom_sheet","android.widget.FrameLayout",host,16,60,1064,2160,3)==null,
                "A full-height backdrop must not become a shelf");
        check(panel(44,"design_bottom_sheet","android.widget.FrameLayout",host,16,1450,1064,1890,3)==null,
                "A matching id in the middle of content cannot become a bottom sheet");
        check(panel(44,"bottom_navigation","android.widget.TextView",host,0,1992,1080,2160,3)==null,
                "Generic navigation ids without the Material widget class are not grounded");
        check(panel(44,"bottom_navigation","com.google.android.material.bottomnavigation.BottomNavigationView",
                host,0,1000,1080,2160,3)==null,"A navigation bar cannot be half the activity height");
        check(panel(45,"design_bottom_sheet","android.widget.FrameLayout",host,16,1550,1064,2160,3).id!=sheet.id,
                "Switching application windows invalidates internal support identities");
        check(edges(keyboard,layer(sheet),appBase).equals(layer(ime(50,0,1420,1080,2160))),
                "An internal sheet behind the IME does not survive as a keyboard-width support");
        System.out.println("PetWindows: IME, modal, floating, split, z-order, region seams, insets, closure and semantic bottom panels checked");
    }
}
